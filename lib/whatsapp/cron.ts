/**
 * Job diario de WhatsApp (Fase 7.5, Bloque 4). Corre a las 8am CDMX (14:00 UTC).
 *
 * Por cada gym con whatsapp_automatico (Escala) + whatsapp_activo:
 *  - miembros que vencen en exactamente 7 días  → MEMBRESIA_POR_VENCER
 *  - miembros que vencieron hoy                 → MEMBRESIA_VENCIDA
 *  - miembros activos sin check-in en 14+ días  → MIEMBRO_SIN_ACTIVIDAD (al owner)
 *  - resumen del día al owner                   → RESUMEN_DIARIO
 *
 * Todo pasa por notifyWhatsapp (no-op si la infra está dormida). Aquí SÍ se
 * hace await (no hay respuesta HTTP en juego): el envío debe completar antes de
 * que termine la función. Cada gym va en try/catch: uno que falle no aborta el
 * resto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature, type Plan } from "@/lib/features";
import { hoyISO, isoMasDias, hoyCDMX } from "@/lib/utils/dates";
import { notifyWhatsapp } from "./notify";
import { registrarMensaje } from "./registro";

interface GymRow {
  id: string;
  slug: string;
  nombre: string;
  telefono: string | null;
  whatsappNumero: string | null;
  whatsappApiKey: string | null;
}

interface MiembroRow {
  nombre: string;
  telefono: string | null;
}

async function gymsActivos(admin: SupabaseClient): Promise<GymRow[]> {
  const { data } = await admin
    .from("gyms")
    .select(
      "id, slug, nombre, telefono, plan, whatsapp_numero, whatsapp_api_key"
    )
    .eq("whatsapp_activo", true);

  return (data ?? [])
    .filter((g) => hasFeature(g.plan as Plan, "whatsapp_automatico"))
    .map((g) => ({
      id: g.id as string,
      slug: g.slug as string,
      nombre: g.nombre as string,
      telefono: (g.telefono as string | null) ?? null,
      whatsappNumero: (g.whatsapp_numero as string | null) ?? null,
      whatsappApiKey: (g.whatsapp_api_key as string | null) ?? null,
    }));
}

/** Miembros no archivados con vencimiento exactamente en `ymd`. */
async function miembrosConVencimiento(
  admin: SupabaseClient,
  tenantId: string,
  ymd: string
): Promise<MiembroRow[]> {
  const { data } = await admin
    .from("miembros")
    .select("nombre, telefono")
    .eq("tenant_id", tenantId)
    .eq("archivado", false)
    .eq("fecha_vencimiento", ymd);
  return (data ?? []).map((m) => ({
    nombre: m.nombre as string,
    telefono: (m.telefono as string | null) ?? null,
  }));
}

/** Miembros activos (vigentes) sin check-in en 14+ días, con los días exactos. */
async function miembrosInactivos(
  admin: SupabaseClient,
  tenantId: string,
  hoyStr: string
): Promise<(MiembroRow & { dias: number })[]> {
  const { data: activos } = await admin
    .from("miembros")
    .select("id, nombre, telefono")
    .eq("tenant_id", tenantId)
    .eq("archivado", false)
    .gte("fecha_vencimiento", hoyStr);
  if (!activos?.length) return [];

  // Último check-in por miembro en los últimos 180 días.
  const hace180 = new Date(hoyCDMX().getTime() - 180 * 86400000).toISOString();
  const { data: cks } = await admin
    .from("checkins")
    .select("miembro_id, fecha_hora")
    .eq("tenant_id", tenantId)
    .gte("fecha_hora", hace180)
    .order("fecha_hora", { ascending: false });

  const ultimo = new Map<string, string>();
  for (const c of cks ?? []) {
    const id = c.miembro_id as string | null;
    if (id && !ultimo.has(id)) ultimo.set(id, c.fecha_hora as string);
  }

  const hoyMs = hoyCDMX().getTime();
  const res: (MiembroRow & { dias: number })[] = [];
  for (const m of activos) {
    const last = ultimo.get(m.id as string);
    const dias = last
      ? Math.floor((hoyMs - new Date(last).getTime()) / 86400000)
      : 180;
    if (dias >= 14) {
      res.push({
        nombre: m.nombre as string,
        telefono: (m.telefono as string | null) ?? null,
        dias,
      });
    }
  }
  return res;
}

interface ResumenGym {
  checkinshoy: number;
  ingresosHoy: number;
  vencimientosEstaSemana: number;
  prospectosPendientes: number;
}

async function resumenGym(
  admin: SupabaseClient,
  tenantId: string,
  hoyStr: string,
  en7Str: string
): Promise<ResumenGym> {
  const inicioHoy = hoyCDMX().toISOString();

  const [ckRes, pagosRes, vencRes, prospRes] = await Promise.all([
    admin
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("fecha_hora", inicioHoy),
    admin
      .from("pagos")
      .select("monto")
      .eq("tenant_id", tenantId)
      .is("anulado_at", null)
      .gte("fecha_pago", inicioHoy),
    admin
      .from("miembros")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("archivado", false)
      .gte("fecha_vencimiento", hoyStr)
      .lte("fecha_vencimiento", en7Str),
    admin
      .from("prospectos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("estado", ["nuevo", "contactado", "agendado"]),
  ]);

  const ingresosHoy = (pagosRes.data ?? []).reduce(
    (s, p) => s + Number(p.monto),
    0
  );

  return {
    checkinshoy: ckRes.count ?? 0,
    ingresosHoy,
    vencimientosEstaSemana: vencRes.count ?? 0,
    prospectosPendientes: prospRes.count ?? 0,
  };
}

export async function runWhatsappCron(): Promise<{
  gyms: number;
  eventos: number;
}> {
  const admin = createAdminClient();
  const gyms = await gymsActivos(admin);
  const hoy = hoyISO();
  const en7 = isoMasDias(7);
  let eventos = 0;

  for (const gym of gyms) {
    try {
      const base = {
        gymId: gym.id,
        gymSlug: gym.slug,
        gymNombre: gym.nombre,
        whatsappNumero: gym.whatsappNumero,
        whatsappApiKey: gym.whatsappApiKey,
      };

      // 1. Vencen en exactamente 7 días.
      for (const m of await miembrosConVencimiento(admin, gym.id, en7)) {
        await notifyWhatsapp({
          ...base,
          tipo: "MEMBRESIA_POR_VENCER",
          miembroNombre: m.nombre,
          miembroTelefono: m.telefono,
          diasRestantes: 7,
          fechaVencimiento: en7,
        });
        await registrarMensaje({
          tenantId: gym.id,
          telefono: m.telefono ?? "",
          direccion: "saliente",
          tipo: "template",
          contenido: `Recordatorio: tu membresía vence el ${en7} (en 7 días).`,
          nombreContacto: m.nombre,
        });
        eventos++;
      }

      // 2. Vencieron hoy.
      for (const m of await miembrosConVencimiento(admin, gym.id, hoy)) {
        await notifyWhatsapp({
          ...base,
          tipo: "MEMBRESIA_VENCIDA",
          miembroNombre: m.nombre,
          miembroTelefono: m.telefono,
          fechaVencimiento: hoy,
        });
        await registrarMensaje({
          tenantId: gym.id,
          telefono: m.telefono ?? "",
          direccion: "saliente",
          tipo: "template",
          contenido: `Tu membresía venció hoy (${hoy}). Renueva para seguir entrenando.`,
          nombreContacto: m.nombre,
        });
        eventos++;
      }

      // 3. Inactivos 14+ días → al owner.
      for (const m of await miembrosInactivos(admin, gym.id, hoy)) {
        await notifyWhatsapp({
          ...base,
          tipo: "MIEMBRO_SIN_ACTIVIDAD",
          miembroNombre: m.nombre,
          miembroTelefono: m.telefono,
          ownerTelefono: gym.telefono,
          diasSinVenir: m.dias,
        });
        eventos++;
      }

      // 4. Resumen del día → al owner.
      const resumen = await resumenGym(admin, gym.id, hoy, en7);
      await notifyWhatsapp({
        ...base,
        tipo: "RESUMEN_DIARIO",
        ownerTelefono: gym.telefono,
        ...resumen,
      });
      eventos++;
    } catch (err) {
      console.error("[cron whatsapp] gym", gym.id, err);
    }
  }

  return { gyms: gyms.length, eventos };
}
