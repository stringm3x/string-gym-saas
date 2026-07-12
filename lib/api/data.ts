import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/utils/notifications";
import { getEstadoMembresia, diasParaVencer } from "@/lib/utils/estado-membresia";
import { hoyISO } from "@/lib/utils/dates";

export interface GymPublic {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_acento: string | null;
  telefono: string | null;
  direccion: string | null;
}

/** Info pública del gym por slug (para GET /info, sin API key). */
export async function apiGetGymPublic(
  slug: string,
  admin: SupabaseClient
): Promise<GymPublic | null> {
  const { data } = await admin
    .from("gyms")
    .select("id, nombre, slug, logo_url, color_acento, telefono, direccion")
    .eq("slug", slug)
    .maybeSingle();
  return (data as GymPublic | null) ?? null;
}

/** Crea un prospecto con origen 'api' (requiere migración 027). */
export async function apiCreateProspecto(
  tenantId: string,
  input: {
    nombre: string;
    telefono: string;
    email?: string;
    mensaje?: string;
    origenDetalle?: string;
  },
  admin: SupabaseClient
): Promise<{ id: string | null; error?: string }> {
  const notaPartes: string[] = [];
  if (input.mensaje) notaPartes.push(input.mensaje);
  if (input.origenDetalle) notaPartes.push(`(origen: ${input.origenDetalle})`);
  const notas = notaPartes.join(" ") || null;

  const { data, error } = await admin
    .from("prospectos")
    .insert({
      tenant_id: tenantId,
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email || null,
      origen: "api",
      estado: "nuevo",
      notas,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message };

  // Notificación in-app al gym (Fase 7.3).
  await createNotification(
    tenantId,
    "prospecto",
    `Nuevo prospecto: ${input.nombre}`,
    input.mensaje,
    "prospectos"
  );

  return { id: data.id };
}

// ============================================================
// MIEMBRO POR TELÉFONO (Fase 7.5B — bot de WhatsApp)
// ============================================================

export interface ApiMiembroReserva {
  reserva_id: string;
  clase: string;
  fecha: string;
  hora_inicio: string;
  estado: string;
}

export interface ApiMiembroPorTelefono {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  membresia: {
    estado: string;
    fecha_vencimiento: string | null;
    dias_restantes: number | null;
    plan: { id: string; nombre: string; precio: number } | null;
  };
  proximas_reservas: ApiMiembroReserva[];
}

/** Últimos 10 dígitos (ignora lada país 52/521). */
function ultimos10(s: string | null): string {
  return (s ?? "").replace(/\D/g, "").slice(-10);
}

/**
 * Miembro por teléfono para el bot de WhatsApp. Matchea por últimos 10 dígitos.
 * Si hay varios, prioriza el vigente (fecha_vencimiento >= hoy) y, si ninguno,
 * el más reciente por created_at. Devuelve membresía + próximas reservas.
 */
export async function apiGetMiembroPorTelefono(
  tenantId: string,
  tel: string,
  admin: SupabaseClient
): Promise<ApiMiembroPorTelefono | null> {
  const objetivo = ultimos10(tel);
  if (objetivo.length < 8) return null;

  const { data: miembros } = await admin
    .from("miembros")
    .select("id, nombre, telefono, email, fecha_vencimiento, plan_id, created_at")
    .eq("tenant_id", tenantId)
    .eq("archivado", false);

  const candidatos = (miembros ?? []).filter(
    (m) => ultimos10(m.telefono as string | null) === objetivo
  );
  if (candidatos.length === 0) return null;

  const hoy = hoyISO();
  candidatos.sort((a, b) => {
    const aVig = ((a.fecha_vencimiento as string | null) ?? "") >= hoy ? 1 : 0;
    const bVig = ((b.fecha_vencimiento as string | null) ?? "") >= hoy ? 1 : 0;
    if (aVig !== bVig) return bVig - aVig; // vigente primero
    return String(b.created_at).localeCompare(String(a.created_at)); // más reciente
  });
  const m = candidatos[0];

  let plan: { id: string; nombre: string; precio: number } | null = null;
  if (m.plan_id) {
    const { data: p } = await admin
      .from("planes_membresia")
      .select("id, nombre, precio")
      .eq("tenant_id", tenantId)
      .eq("id", m.plan_id as string)
      .maybeSingle();
    if (p) {
      plan = {
        id: p.id as string,
        nombre: p.nombre as string,
        precio: Number(p.precio),
      };
    }
  }

  const { data: reservas } = await admin
    .from("clases_reservas")
    .select(
      "id, estado, sesion:clases_sesiones(fecha, hora_inicio, clase:clases(nombre))"
    )
    .eq("tenant_id", tenantId)
    .eq("miembro_id", m.id as string)
    .in("estado", ["confirmada", "en_lista_espera"]);

  const proximas: ApiMiembroReserva[] = (reservas ?? [])
    .map((r) => {
      const s = Array.isArray(r.sesion) ? r.sesion[0] : r.sesion;
      const claseRaw = s?.clase;
      const clase = Array.isArray(claseRaw) ? claseRaw[0] : claseRaw;
      return {
        reserva_id: r.id as string,
        clase: (clase?.nombre as string | undefined) ?? "",
        fecha: (s?.fecha as string | undefined) ?? "",
        hora_inicio: ((s?.hora_inicio as string | undefined) ?? "").slice(0, 5),
        estado: r.estado as string,
      };
    })
    .filter((r) => r.fecha && r.fecha >= hoy)
    .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio))
    .slice(0, 10);

  const fv = (m.fecha_vencimiento as string | null) ?? null;
  return {
    id: m.id as string,
    nombre: m.nombre as string,
    telefono: (m.telefono as string | null) ?? null,
    email: (m.email as string | null) ?? null,
    membresia: {
      estado: getEstadoMembresia(fv),
      fecha_vencimiento: fv,
      dias_restantes: diasParaVencer(fv),
      plan,
    },
    proximas_reservas: proximas,
  };
}
