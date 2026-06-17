import { createClient } from "@/lib/supabase/server";

export interface GymAddon {
  tenant_id: string;
  addon_id: string;
  estado: "activo" | "suspendido" | "cancelado";
  fecha_activacion: string;
  fecha_cancelacion: string | null;
  precio_actual: number;
  notas: string | null;
}

export async function listGymAddons(tenantId: string): Promise<GymAddon[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gym_addons")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("fecha_activacion", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({ ...row, precio_actual: Number(row.precio_actual) }));
}

export async function getGymAddon(
  tenantId: string,
  addonId: string
): Promise<GymAddon | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gym_addons")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("addon_id", addonId)
    .single();

  if (error || !data) return null;
  return { ...data, precio_actual: Number(data.precio_actual) };
}

/** True solo si el add-on existe Y está en estado 'activo'. */
export async function hasAddon(
  tenantId: string,
  addonId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("gym_addons")
    .select("addon_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("addon_id", addonId)
    .eq("estado", "activo");

  if (error) return false;
  return (count ?? 0) > 0;
}

export async function countAddonsActivos(tenantId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("gym_addons")
    .select("addon_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("estado", "activo");

  if (error) return 0;
  return count ?? 0;
}
