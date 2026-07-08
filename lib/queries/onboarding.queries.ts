import { createClient } from "@/lib/supabase/server";
import { DEMO_MIEMBRO_NOTAS } from "@/lib/constants";

export interface DemoMiembro {
  id: string;
  qr_token: string | null;
}

/** Miembro de demo autocreado (Fase P.2), si existe. Se identifica por su nota. */
export async function getDemoMiembro(
  tenantId: string
): Promise<DemoMiembro | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembros")
    .select("id, qr_token")
    .eq("tenant_id", tenantId)
    .eq("notas", DEMO_MIEMBRO_NOTAS)
    .eq("archivado", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as DemoMiembro | null) ?? null;
}

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
