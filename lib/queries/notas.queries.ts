import { createClient } from "@/lib/supabase/server";

export interface Nota {
  id: string;
  tenant_id: string;
  miembro_id: string;
  contenido: string;
  created_at: string;
}

export async function listNotas(
  tenantId: string,
  miembroId: string
): Promise<Nota[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function createNota(
  tenantId: string,
  miembroId: string,
  contenido: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas")
    .insert({ tenant_id: tenantId, miembro_id: miembroId, contenido })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo guardar la nota" };
  }
  return { ok: true, id: data.id };
}
