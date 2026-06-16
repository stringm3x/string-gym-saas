import { createClient } from "@/lib/supabase/server";

export type TipoAccion = "llamada" | "whatsapp" | "visita" | "email" | "otro";

export interface Nota {
  id: string;
  tenant_id: string;
  entidad_tipo: "miembro" | "prospecto";
  entidad_id: string;
  contenido: string;
  tipo_accion: TipoAccion | null;
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
  tipoAccion?: TipoAccion
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
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo guardar la nota" };
  }
  return { ok: true, id: data.id };
}
