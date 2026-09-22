/**
 * Job diario de WhatsApp (Fase 7.5, Bloque 4). Corre a las 8am CDMX (14:00 UTC).
 *
 * Por cada gym con whatsapp_automatico (Escala) + whatsapp_activo:
 *  - miembros que vencen en exactamente 3 o 7 días → MEMBRESIA_POR_VENCER
 *  - miembros que vencieron hoy                    → MEMBRESIA_VENCIDA
 *  - miembros que vencieron hace exactamente 3 días
 *    y no han renovado                             → MEMBRESIA_REACTIVACION
 *  - cumpleaños hoy                                → CUMPLEANOS
 *  - miembros activos sin check-in en 14+ días      → MIEMBRO_SIN_ACTIVIDAD (al owner)
 *  - resumen del día al owner                       → RESUMEN_DIARIO
 *
 * Todo pasa por notifyWhatsapp (no-op si la infra está dormida). Aquí SÍ se
 * hace await (no hay respuesta HTTP en juego): el envío debe completar antes de
 * que termine la función. Cada gym va en try/catch: uno que falle no aborta el
 * resto. Solo se registra en el inbox (wa_mensajes, "saliente") lo que
 * notifyWhatsapp confirmó enviado — un envío fallido no aparece como si
 * hubiera salido, se cuenta en `fallidos` y queda logueado.
 *
 * Deduplicación: por diseño, no por tabla de tracking — cada bloque filtra por
 * IGUALDAD EXACTA de fecha (ej. fecha_vencimiento = hoy-3), así que un miembro
 * solo puede caer en cada bucket un día del calendario. Si el cron se
 * re-ejecuta el mismo día o una fecha cambia justo después de correr, sí
 * puede duplicar — mismo trade-off que ya existía en los bloques originales.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature, type Plan } from "@/lib/features";
import { hoyISO, isoMasDias, hoyCDMX } from "@/lib/utils/dates";
import { logError } from "@/lib/log";
import { gymOperativo } from "@/lib/utils/gym-operativo";
import { notifyWhatsapp, type WhatsappEvent } from "./notify";
import { registrarMensaje, type RegistrarMensajeParams } from "./registro";
import {
  TEMPLATE_RECORDATORIO_VENCIMIENTO,
  TEMPLATE_MEMBRESIA_VENCIDA,
  TEMPLATE_MEMBRESIA_REACTIVACION,
  TEMPLATE_CUMPLEANOS,
  TEMPLATE_MIEMBRO_INACTIVO,
  TEMPLATE_RESUMEN_DIARIO,
  TEMPLATE_CATEGORIA,
} from "./360dialog";

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
      "id, slug, nombre, telefono, plan, whatsapp_numero, whatsapp_api_key, estado, prueba_hasta"
    )
    .eq("whatsapp_activo", true);

  // Bloque 10: un gym suspendido o con la prueba vencida no debe seguirle
  // mandando recordatorios a sus socios — antes solo se filtraba por
  // whatsapp_activo/plan, sin mirar el estado del gym.
  return (data ?? [])
    .filter((g) => hasFeature(g.plan as Plan, "whatsapp_automatico"))
    .filter((g) => gymOperativo(g as { estado: string; prueba_hasta: string | null }))
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

/**
 * Miembros no archivados cuyo cumpleaños (mes+día, sin importar el año) es
 * hoy. No hay forma barata de filtrar mes/día por fecha con el query builder
 * de Supabase, así que se trae todo lo que tenga fecha_nacimiento y se
 * filtra en JS — mismo patrón que `miembrosInactivos` con check-ins.
 */
async function miembrosDeCumpleanos(
  admin: SupabaseClient,
  tenantId: string,
  mesDia: string // "MM-DD"
): Promise<MiembroRow[]> {
  const { data } = await admin
    .from("miembros")
    .select("nombre, telefono, fecha_nacimiento")
    .eq("tenant_id", tenantId)
    .eq("archivado", false)
    .not("fecha_nacimiento", "is", null);

  return (data ?? [])
    .filter((m) => (m.fecha_nacimiento as string).slice(5) === mesDia)
    .map((m) => ({
      nombre: m.nombre as string,
      telefono: (m.telefono as string | null) ?? null,
    }));
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
      .is("reembolsado_at", null)
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

interface Contadores {
  intentos: number;
  enviados: number;
  fallidos: number;
}

/**
 * Envía el evento y, SOLO si notifyWhatsapp confirma el envío, lo registra
 * en el inbox como "saliente". Antes se registraba siempre, sin importar el
 * resultado: el inbox mostraba mensajes que nunca salieron (infra dormida,
 * 360dialog caído, número sin WhatsApp) como si el socio los hubiera
 * recibido. Un fallo se cuenta y se loguea — antes el cron solo contaba
 * intentos y respondía `ok: true` sin decir cuántos de verdad llegaron.
 */
async function enviarYRegistrar(
  gymId: string,
  event: WhatsappEvent,
  registro: Omit<RegistrarMensajeParams, "direccion"> | null,
  c: Contadores
): Promise<void> {
  c.intentos++;
  const enviado = await notifyWhatsapp(event);
  if (!enviado) {
    c.fallidos++;
    logError("whatsapp_cron.envio_fallido", { gymId, tipo: event.tipo });
    return;
  }
  c.enviados++;
  if (registro) await registrarMensaje({ ...registro, direccion: "saliente" });
}

export async function runWhatsappCron(): Promise<{
  gyms: number;
  intentos: number;
  enviados: number;
  fallidos: number;
}> {
  const admin = createAdminClient();
  const gyms = await gymsActivos(admin);
  const hoy = hoyISO();
  const en3 = isoMasDias(3);
  const en7 = isoMasDias(7);
  const vencioHace3 = isoMasDias(-3);
  const mesDiaHoy = hoy.slice(5);
  const c: Contadores = { intentos: 0, enviados: 0, fallidos: 0 };

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
        await enviarYRegistrar(
          gym.id,
          {
            ...base,
            tipo: "MEMBRESIA_POR_VENCER",
            miembroNombre: m.nombre,
            miembroTelefono: m.telefono,
            diasRestantes: 7,
            fechaVencimiento: en7,
          },
          {
            tenantId: gym.id,
            telefono: m.telefono ?? "",
            tipo: "template",
            contenido: `Recordatorio: tu membresía vence el ${en7} (en 7 días).`,
            nombreContacto: m.nombre,
            nombrePlantilla: TEMPLATE_RECORDATORIO_VENCIMIENTO,
            categoria: TEMPLATE_CATEGORIA[TEMPLATE_RECORDATORIO_VENCIMIENTO],
          },
          c
        );
      }

      // 1b. Vencen en exactamente 3 días (recordatorio intermedio, mismo
      //     tipo que el de 7 días — la plantilla ya parametriza los días).
      for (const m of await miembrosConVencimiento(admin, gym.id, en3)) {
        await enviarYRegistrar(
          gym.id,
          {
            ...base,
            tipo: "MEMBRESIA_POR_VENCER",
            miembroNombre: m.nombre,
            miembroTelefono: m.telefono,
            diasRestantes: 3,
            fechaVencimiento: en3,
          },
          {
            tenantId: gym.id,
            telefono: m.telefono ?? "",
            tipo: "template",
            contenido: `Recordatorio: tu membresía vence el ${en3} (en 3 días).`,
            nombreContacto: m.nombre,
            nombrePlantilla: TEMPLATE_RECORDATORIO_VENCIMIENTO,
            categoria: TEMPLATE_CATEGORIA[TEMPLATE_RECORDATORIO_VENCIMIENTO],
          },
          c
        );
      }

      // 2. Vencieron hoy.
      for (const m of await miembrosConVencimiento(admin, gym.id, hoy)) {
        await enviarYRegistrar(
          gym.id,
          {
            ...base,
            tipo: "MEMBRESIA_VENCIDA",
            miembroNombre: m.nombre,
            miembroTelefono: m.telefono,
            fechaVencimiento: hoy,
          },
          {
            tenantId: gym.id,
            telefono: m.telefono ?? "",
            tipo: "template",
            contenido: `Tu membresía venció hoy (${hoy}). Renueva para seguir entrenando.`,
            nombreContacto: m.nombre,
            nombrePlantilla: TEMPLATE_MEMBRESIA_VENCIDA,
            categoria: TEMPLATE_CATEGORIA[TEMPLATE_MEMBRESIA_VENCIDA],
          },
          c
        );
      }

      // 2b. Vencieron hace exactamente 3 días y no han renovado (si hubieran
      //     renovado, fecha_vencimiento ya no sería esta — la igualdad
      //     exacta los excluye solos).
      for (const m of await miembrosConVencimiento(admin, gym.id, vencioHace3)) {
        await enviarYRegistrar(
          gym.id,
          {
            ...base,
            tipo: "MEMBRESIA_REACTIVACION",
            miembroNombre: m.nombre,
            miembroTelefono: m.telefono,
            diasVencido: 3,
          },
          {
            tenantId: gym.id,
            telefono: m.telefono ?? "",
            tipo: "template",
            contenido: `Te extrañamos por ${gym.nombre} — tu membresía venció hace 3 días. ¿Renovamos?`,
            nombreContacto: m.nombre,
            nombrePlantilla: TEMPLATE_MEMBRESIA_REACTIVACION,
            categoria: TEMPLATE_CATEGORIA[TEMPLATE_MEMBRESIA_REACTIVACION],
          },
          c
        );
      }

      // 2c. Cumpleaños hoy.
      for (const m of await miembrosDeCumpleanos(admin, gym.id, mesDiaHoy)) {
        await enviarYRegistrar(
          gym.id,
          {
            ...base,
            tipo: "CUMPLEANOS",
            miembroNombre: m.nombre,
            miembroTelefono: m.telefono,
          },
          {
            tenantId: gym.id,
            telefono: m.telefono ?? "",
            tipo: "template",
            contenido: `¡Feliz cumpleaños de parte de ${gym.nombre}! 🎉`,
            nombreContacto: m.nombre,
            nombrePlantilla: TEMPLATE_CUMPLEANOS,
            categoria: TEMPLATE_CATEGORIA[TEMPLATE_CUMPLEANOS],
          },
          c
        );
      }

      // 3. Inactivos 14+ días → al owner. No es una conversación con el
      //    socio inactivo: se registra con destinatario "dueno" (sql/070),
      //    conversacion_id NULL — el inbox del socio nunca lo ve.
      for (const m of await miembrosInactivos(admin, gym.id, hoy)) {
        await enviarYRegistrar(
          gym.id,
          {
            ...base,
            tipo: "MIEMBRO_SIN_ACTIVIDAD",
            miembroNombre: m.nombre,
            miembroTelefono: m.telefono,
            ownerTelefono: gym.telefono,
            diasSinVenir: m.dias,
          },
          {
            tenantId: gym.id,
            telefono: gym.telefono ?? "",
            tipo: "template",
            contenido: `${m.nombre} lleva ${m.dias} días sin venir.`,
            destinatario: "dueno",
            nombrePlantilla: TEMPLATE_MIEMBRO_INACTIVO,
            categoria: TEMPLATE_CATEGORIA[TEMPLATE_MIEMBRO_INACTIVO],
          },
          c
        );
      }

      // 4. Resumen del día → al owner. Mismo criterio que el punto 3.
      const resumen = await resumenGym(admin, gym.id, hoy, en7);
      await enviarYRegistrar(
        gym.id,
        {
          ...base,
          tipo: "RESUMEN_DIARIO",
          ownerTelefono: gym.telefono,
          ...resumen,
        },
        {
          tenantId: gym.id,
          telefono: gym.telefono ?? "",
          tipo: "template",
          contenido: "Resumen diario enviado.",
          destinatario: "dueno",
          nombrePlantilla: TEMPLATE_RESUMEN_DIARIO,
          categoria: TEMPLATE_CATEGORIA[TEMPLATE_RESUMEN_DIARIO],
        },
        c
      );
    } catch (err) {
      logError("whatsapp_cron.gym_fallo", {
        gymId: gym.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { gyms: gyms.length, ...c };
}
