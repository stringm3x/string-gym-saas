import { createClient } from "@/lib/supabase/server";

export type PlantillaCategoria =
  | "miembro_activo"
  | "miembro_por_vencer"
  | "miembro_vencido"
  | "prospecto"
  | "general";

export interface PlantillaMensaje {
  id: string;
  tenant_id: string;
  nombre: string;
  categoria: PlantillaCategoria;
  contenido: string;
  activo: boolean;
  created_at: string;
}

export async function listPlantillas(
  tenantId: string,
  options?: { categoria?: PlantillaCategoria; soloActivas?: boolean }
): Promise<PlantillaMensaje[]> {
  const supabase = await createClient();
  let query = supabase
    .from("plantillas_mensaje")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");

  if (options?.categoria) {
    query = query.eq("categoria", options.categoria);
  }
  if (options?.soloActivas !== false) {
    query = query.eq("activo", true);
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}
