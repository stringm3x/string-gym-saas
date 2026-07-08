import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type OpinionOrigen = "portal" | "kiosco" | "manual";

export interface OpinionItem {
  id: string;
  calificacion: number;
  comentario: string | null;
  created_at: string;
  miembro_nombre: string | null;
}

export interface OpinionesResumen {
  promedioMes: number;
  promedioMesAnterior: number;
  totalMes: number;
  /** Conteo por estrella: índice 0 = 1★ … índice 4 = 5★. */
  distribucion: number[];
  ultimas: OpinionItem[];
}

function promedio(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

/** Resumen de opiniones para el dueño (promedio del mes, distribución, etc.). */
export async function getOpinionesResumen(
  tenantId: string
): Promise<OpinionesResumen> {
  const supabase = await createClient();
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

  const [rango, ultimasRes] = await Promise.all([
    supabase
      .from("opiniones")
      .select("calificacion, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", inicioMesAnt.toISOString()),
    supabase
      .from("opiniones")
      .select("id, calificacion, comentario, created_at, miembros(nombre)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const filas = (rango.data ?? []) as {
    calificacion: number;
    created_at: string;
  }[];
  const mes: number[] = [];
  const mesAnt: number[] = [];
  const distribucion = [0, 0, 0, 0, 0];
  const inicioMesIso = inicioMes.toISOString();
  for (const f of filas) {
    if (f.created_at >= inicioMesIso) {
      mes.push(f.calificacion);
      const i = f.calificacion - 1;
      if (i >= 0 && i <= 4) distribucion[i]++;
    } else {
      mesAnt.push(f.calificacion);
    }
  }

  const ultimas: OpinionItem[] = (
    (ultimasRes.data ?? []) as unknown as Array<{
      id: string;
      calificacion: number;
      comentario: string | null;
      created_at: string;
      miembros: { nombre: string } | null;
    }>
  ).map((o) => ({
    id: o.id,
    calificacion: o.calificacion,
    comentario: o.comentario,
    created_at: o.created_at,
    miembro_nombre: o.miembros?.nombre ?? null,
  }));

  return {
    promedioMes: promedio(mes),
    promedioMesAnterior: promedio(mesAnt),
    totalMes: mes.length,
    distribucion,
    ultimas,
  };
}

/**
 * Google Place ID del gym (para el botón de reseña). Query DEDICADA: no toca
 * getGymMarca ni getPortalGym para no acoplar sus SELECT a esta columna.
 */
export async function getGooglePlaceId(
  tenantId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("google_place_id")
    .eq("id", tenantId)
    .maybeSingle();
  return (data?.google_place_id as string | null) ?? null;
}

/** Guarda el Google Place ID del gym (Configuración → Marca). */
export async function updateGooglePlaceId(
  tenantId: string,
  placeId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ google_place_id: placeId.trim() || null })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Promedio de calificación de los últimos 7 días (para la alerta de /hoy). */
export async function getPromedioSemana(
  tenantId: string
): Promise<{ promedio: number; total: number }> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("opiniones")
    .select("calificacion")
    .eq("tenant_id", tenantId)
    .gte("created_at", desde);
  const nums = (data ?? []).map((o) => o.calificacion as number);
  return { promedio: promedio(nums), total: nums.length };
}

/** ¿El miembro ya dejó una opinión hoy? (máx. 1 por día). Service-role. */
export async function yaOpinoHoy(
  tenantId: string,
  miembroId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const { count } = await admin
    .from("opiniones")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .gte("created_at", inicioDia.toISOString());
  return (count ?? 0) > 0;
}

/** Crea una opinión (service-role: el portal no usa Supabase Auth). */
export async function crearOpinion(params: {
  tenantId: string;
  miembroId: string | null;
  calificacion: number;
  comentario?: string | null;
  origen: OpinionOrigen;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("opiniones").insert({
    tenant_id: params.tenantId,
    miembro_id: params.miembroId,
    calificacion: params.calificacion,
    comentario: params.comentario?.trim() || null,
    origen: params.origen,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
