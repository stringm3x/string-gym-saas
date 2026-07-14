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
 * ¿El gym bloquea el acceso a miembros con membresía vencida? (Fase Bug#7).
 * Default true (bloquear) si falta el dato o la columna. Acepta un client
 * opcional para reusar el admin en flujos públicos (kiosco).
 */
export async function bloqueaVencidos(
  tenantId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("gyms")
    .select("checkin_bloquea_vencidos")
    .eq("id", tenantId)
    .maybeSingle();
  return data ? (data.checkin_bloquea_vencidos as boolean) : true;
}

/**
 * ¿El socio es de plan por visitas y ya no le quedan? (D3, bloqueo de check-in).
 * false para planes por tiempo (visitas_restantes null).
 */
export async function visitasAgotadas(
  tenantId: string,
  miembroId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("miembros")
    .select("visitas_restantes")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  const v = data?.visitas_restantes as number | null | undefined;
  return v !== null && v !== undefined && v <= 0;
}

/**
 * Registra un check-in del miembro. Retorna { ok, id } o error. Si el plan es
 * por visitas (visitas_restantes no null), descuenta 1 visita (D3).
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

  // Descuento de visita (solo planes por visitas; guardado contra negativos).
  const { data: m } = await supabase
    .from("miembros")
    .select("visitas_restantes")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  const restantes = m?.visitas_restantes as number | null | undefined;
  if (restantes !== null && restantes !== undefined && restantes > 0) {
    await supabase
      .from("miembros")
      .update({ visitas_restantes: restantes - 1 })
      .eq("tenant_id", tenantId)
      .eq("id", miembroId);
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
