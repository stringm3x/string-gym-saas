import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyCDMX } from "@/lib/utils/dates";

export interface Checkin {
  id: string;
  tenant_id: string;
  miembro_id: string;
  fecha_hora: string;
}

export interface CheckinConMiembro extends Checkin {
  miembro_nombre: string;
}

/**
 * Registra un check-in del miembro. Retorna { ok, id } o error.
 */
export async function createCheckin(
  tenantId: string,
  miembroId: string,
  client?: SupabaseClient
): Promise<
  { ok: true; id: string; fecha_hora: string } | { ok: false; error: string }
> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .from("checkins")
    .insert({ tenant_id: tenantId, miembro_id: miembroId })
    .select("id, fecha_hora")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo registrar el check-in",
    };
  }

  return { ok: true, id: data.id, fecha_hora: data.fecha_hora };
}

/**
 * Lista los check-ins de un miembro (más recientes primero).
 */
export async function listCheckinsByMiembro(
  tenantId: string,
  miembroId: string,
  limit = 20
): Promise<Checkin[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("fecha_hora", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

/**
 * Lista los check-ins del día con el nombre del miembro embebido.
 * Para el feed de "check-ins de hoy" en la pantalla de recepción.
 */
export async function listCheckinsDeHoy(
  tenantId: string,
  limit = 30
): Promise<CheckinConMiembro[]> {
  const supabase = await createClient();

  const inicioHoy = hoyCDMX();

  const { data, error } = await supabase
    .from("checkins")
    .select("id, tenant_id, miembro_id, fecha_hora, miembros(nombre)")
    .eq("tenant_id", tenantId)
    .gte("fecha_hora", inicioHoy.toISOString())
    .order("fecha_hora", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    miembro_id: row.miembro_id,
    fecha_hora: row.fecha_hora,
    miembro_nombre: row.miembros?.nombre ?? "Miembro desconocido",
  }));
}

/**
 * Cuenta los check-ins de hoy — métrica para dashboard y header.
 */
export async function countCheckinsDeHoy(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const inicioHoy = hoyCDMX();

  const { count, error } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("fecha_hora", inicioHoy.toISOString());

  if (error) return 0;
  return count ?? 0;
}
