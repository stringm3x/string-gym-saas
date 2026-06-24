import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanMembresiaInput } from "@/lib/validations/plan-membresia.schema";

export interface PlanMembresia {
  id: string;
  tenant_id: string;
  nombre: string;
  precio: number;
  dias_duracion: number;
  activo: boolean;
  created_at: string;
}

export async function listPlanes(
  tenantId: string,
  options: { soloActivos?: boolean } = {},
  client?: SupabaseClient
): Promise<PlanMembresia[]> {
  const supabase = client ?? (await createClient());

  let q = supabase
    .from("planes_membresia")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("precio", { ascending: true });

  if (options.soloActivos) {
    q = q.eq("activo", true);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((p) => ({ ...p, precio: Number(p.precio) }));
}

export async function getPlan(
  tenantId: string,
  id: string
): Promise<PlanMembresia | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planes_membresia")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return { ...data, precio: Number(data.precio) };
}

export async function createPlan(
  tenantId: string,
  input: PlanMembresiaInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planes_membresia")
    .insert({ tenant_id: tenantId, ...input })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear el plan" };
  }
  return { ok: true, id: data.id };
}

export async function updatePlan(
  tenantId: string,
  id: string,
  input: PlanMembresiaInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("planes_membresia")
    .update(input)
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function togglePlanActivo(
  tenantId: string,
  id: string,
  activo: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("planes_membresia")
    .update({ activo })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
