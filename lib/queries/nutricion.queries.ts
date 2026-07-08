import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Un tiempo de comida dentro del plan (se guarda en el jsonb `comidas`). */
export interface ComidaNutricion {
  tiempo: string; // Desayuno, Comida, Cena, Snack…
  alimentos: string; // texto libre: "3 huevos, avena…"
}

export interface PlanNutricion {
  id: string;
  miembro_id: string;
  titulo: string;
  objetivo: string | null;
  calorias_objetivo: number | null;
  comidas: ComidaNutricion[];
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanNutricionInput {
  titulo: string;
  objetivo?: string | null;
  calorias_objetivo?: number | null;
  comidas: ComidaNutricion[];
  notas?: string | null;
}

function normalizarComidas(comidas: ComidaNutricion[]): ComidaNutricion[] {
  return comidas
    .map((c) => ({
      tiempo: c.tiempo.trim(),
      alimentos: c.alimentos.trim(),
    }))
    .filter((c) => c.tiempo !== "" || c.alimentos !== "");
}

/** Planes de un miembro: el activo primero, luego los más recientes. */
export async function getPlanesNutricion(
  tenantId: string,
  miembroId: string
): Promise<PlanNutricion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planes_nutricion")
    .select(
      "id, miembro_id, titulo, objetivo, calorias_objetivo, comidas, notas, activo, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("activo", { ascending: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as PlanNutricion[]).map((p) => ({
    ...p,
    comidas: Array.isArray(p.comidas) ? p.comidas : [],
  }));
}

/**
 * Plan activo del miembro para el Portal (service-role: el portal no usa
 * Supabase Auth, así que no aplica RLS por sesión).
 */
export async function getPlanNutricionActivoPortal(
  tenantId: string,
  miembroId: string
): Promise<PlanNutricion | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("planes_nutricion")
    .select(
      "id, miembro_id, titulo, objetivo, calorias_objetivo, comidas, notas, activo, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("activo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const p = data as PlanNutricion;
  return { ...p, comidas: Array.isArray(p.comidas) ? p.comidas : [] };
}

/**
 * Crea un plan para el miembro y lo deja como el activo, archivando los
 * planes activos anteriores (siempre hay un solo plan vigente).
 */
export async function createPlanNutricion(
  tenantId: string,
  miembroId: string,
  data: PlanNutricionInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El plan nuevo pasa a ser el vigente; el previo queda como historial.
  await supabase
    .from("planes_nutricion")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("activo", true);

  const { data: creado, error } = await supabase
    .from("planes_nutricion")
    .insert({
      tenant_id: tenantId,
      miembro_id: miembroId,
      creada_por: user?.id ?? null,
      titulo: data.titulo.trim(),
      objetivo: data.objetivo?.trim() || null,
      calorias_objetivo: data.calorias_objetivo ?? null,
      comidas: normalizarComidas(data.comidas),
      notas: data.notas?.trim() || null,
      activo: true,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: creado.id as string };
}

/** Edita un plan existente (sin cambiar su estado activo/archivado). */
export async function updatePlanNutricion(
  tenantId: string,
  planId: string,
  data: PlanNutricionInput
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("planes_nutricion")
    .update({
      titulo: data.titulo.trim(),
      objetivo: data.objetivo?.trim() || null,
      calorias_objetivo: data.calorias_objetivo ?? null,
      comidas: normalizarComidas(data.comidas),
      notas: data.notas?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", planId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Archiva un plan (deja de ser el vigente). */
export async function archivarPlanNutricion(
  tenantId: string,
  planId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("planes_nutricion")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", planId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
