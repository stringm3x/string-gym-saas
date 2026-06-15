import { createClient } from "@/lib/supabase/server";
import type { PromocionInput } from "@/lib/validations/promocion.schema";

export interface Promocion {
  id: string;
  tenant_id: string;
  nombre: string;
  tipo: "membresia" | "producto";
  precio: number;
  dias_duracion: number | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  activo: boolean;
  created_at: string;
}

export async function listPromociones(
  tenantId: string,
  options: {
    soloActivasVigentes?: boolean;
    tipo?: "membresia" | "producto";
  } = {}
): Promise<Promocion[]> {
  const supabase = await createClient();

  let q = supabase
    .from("promociones")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options.tipo) {
    q = q.eq("tipo", options.tipo);
  }

  if (options.soloActivasVigentes) {
    const hoy = new Date().toISOString().slice(0, 10);
    q = q.eq("activo", true);
    // Vigencia: (desde es null o <= hoy) Y (hasta es null o >= hoy)
    q = q.or(`vigencia_desde.is.null,vigencia_desde.lte.${hoy}`);
    q = q.or(`vigencia_hasta.is.null,vigencia_hasta.gte.${hoy}`);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((p) => ({ ...p, precio: Number(p.precio) }));
}

export async function getPromocion(
  tenantId: string,
  id: string
): Promise<Promocion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promociones")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return { ...data, precio: Number(data.precio) };
}

export async function createPromocion(
  tenantId: string,
  input: PromocionInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const payload = {
    tenant_id: tenantId,
    nombre: input.nombre,
    tipo: input.tipo,
    precio: input.precio,
    dias_duracion: input.tipo === "membresia" ? input.dias_duracion : null,
    vigencia_desde: input.vigencia_desde || null,
    vigencia_hasta: input.vigencia_hasta || null,
  };

  const { data, error } = await supabase
    .from("promociones")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo crear la promoción",
    };
  }
  return { ok: true, id: data.id };
}

export async function updatePromocion(
  tenantId: string,
  id: string,
  input: PromocionInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const payload = {
    nombre: input.nombre,
    tipo: input.tipo,
    precio: input.precio,
    dias_duracion: input.tipo === "membresia" ? input.dias_duracion : null,
    vigencia_desde: input.vigencia_desde || null,
    vigencia_hasta: input.vigencia_hasta || null,
  };

  const { error } = await supabase
    .from("promociones")
    .update(payload)
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function togglePromocionActiva(
  tenantId: string,
  id: string,
  activo: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("promociones")
    .update({ activo })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
