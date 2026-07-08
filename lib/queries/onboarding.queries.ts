import { createClient } from "@/lib/supabase/server";

export interface OnboardingEstado {
  tienePlanes: boolean;
  tieneMiembros: boolean;
  tieneProductos: boolean;
  completado: boolean;
}

/** Estado de los 3 pasos del onboarding + flag de completado. */
export async function getOnboardingEstado(
  tenantId: string
): Promise<OnboardingEstado> {
  const supabase = await createClient();

  const [planes, miembros, productos, gym] = await Promise.all([
    supabase
      .from("planes_membresia")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("activo", true),
    supabase
      .from("miembros")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("archivado", false),
    supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("gyms")
      .select("onboarding_completado")
      .eq("id", tenantId)
      .maybeSingle(),
  ]);

  return {
    tienePlanes: (planes.count ?? 0) > 0,
    tieneMiembros: (miembros.count ?? 0) > 0,
    tieneProductos: (productos.count ?? 0) > 0,
    completado: !!gym.data?.onboarding_completado,
  };
}

/** Marca el onboarding como completado para el tenant. */
export async function marcarOnboardingCompletado(
  tenantId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ onboarding_completado: true })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
