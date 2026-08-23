import { createClient } from "@/lib/supabase/server";

export type TipoAccion = "llamada" | "whatsapp" | "visita" | "email" | "otro";

export interface Nota {
  id: string;
  tenant_id: string;
  entidad_tipo: "miembro" | "prospecto";
  entidad_id: string;
  contenido: string;
  tipo_accion: TipoAccion | null;
  fecha_seguimiento: string | null;
  completada: boolean;
  created_at: string;
}

export async function listNotas(
  tenantId: string,
  entidadTipo: "miembro" | "prospecto",
  entidadId: string
): Promise<Nota[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("entidad_tipo", entidadTipo)
    .eq("entidad_id", entidadId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function createNota(
  tenantId: string,
  entidadTipo: "miembro" | "prospecto",
  entidadId: string,
  contenido: string,
  tipoAccion?: TipoAccion,
  fechaSeguimiento?: string | null
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas")
    .insert({
      tenant_id: tenantId,
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      contenido,
      tipo_accion: tipoAccion ?? null,
      fecha_seguimiento: fechaSeguimiento || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo guardar la nota" };
  }
  return { ok: true, id: data.id };
}

export interface NotaSeguimiento extends Nota {
  miembro_nombre: string | null;
}

/**
 * Notas de miembros con fecha de seguimiento pendiente (hoy o vencida, sin
 * completar), con el nombre del miembro resuelto — `entidad_id` es
 * polimórfico (miembro o prospecto) sin FK real, así que el join es manual.
 */
export async function listSeguimientosPendientes(
  tenantId: string,
  hastaISO: string
): Promise<NotaSeguimiento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("entidad_tipo", "miembro")
    .eq("completada", false)
    .not("fecha_seguimiento", "is", null)
    .lte("fecha_seguimiento", hastaISO)
    .order("fecha_seguimiento", { ascending: true });

  if (error || !data?.length) return [];

  const miembroIds = [...new Set(data.map((n) => n.entidad_id as string))];
  const { data: miembros } = await supabase
    .from("miembros")
    .select("id, nombre")
    .eq("tenant_id", tenantId)
    .in("id", miembroIds);
  const nombreDe = new Map(
    (miembros ?? []).map((m) => [m.id as string, m.nombre as string])
  );

  return data.map((n) => ({
    ...n,
    miembro_nombre: nombreDe.get(n.entidad_id as string) ?? null,
  }));
}

export async function toggleNotaCompletada(
  tenantId: string,
  notaId: string,
  completada: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notas")
    .update({ completada })
    .eq("tenant_id", tenantId)
    .eq("id", notaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
