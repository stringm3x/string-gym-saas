import { createClient } from "@/lib/supabase/server";
import type { ProspectoEstado, ProspectoInput } from "@/lib/validations/prospecto.schema";

export interface Prospecto {
  id: string;
  tenant_id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  origen: "landing" | "whatsapp" | "referido" | "manual";
  estado: ProspectoEstado;
  fecha_prueba_agendada: string | null;
  notas: string | null;
  created_at: string;
}

export interface ListProspectosOptions {
  estado?: ProspectoEstado;
  search?: string;
}

export async function listProspectos(
  tenantId: string,
  options?: ListProspectosOptions
): Promise<Prospecto[]> {
  const supabase = await createClient();

  let query = supabase
    .from("prospectos")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.estado) {
    query = query.eq("estado", options.estado);
  }

  if (options?.search && options.search.trim().length > 0) {
    const q = options.search.trim();
    query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("listProspectos error:", error);
    return [];
  }

  return data ?? [];
}

export async function getProspecto(
  tenantId: string,
  id: string
): Promise<Prospecto | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prospectos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createProspecto(
  tenantId: string,
  input: ProspectoInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prospectos")
    .insert({
      tenant_id: tenantId,
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email || null,
      origen: input.origen,
      estado: input.estado,
      fecha_prueba_agendada: input.fecha_prueba_agendada || null,
      notas: input.notas || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo crear el prospecto",
    };
  }

  return { ok: true, id: data.id };
}

export async function updateProspecto(
  tenantId: string,
  id: string,
  input: ProspectoInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("prospectos")
    .update({
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email || null,
      origen: input.origen,
      estado: input.estado,
      fecha_prueba_agendada: input.fecha_prueba_agendada || null,
      notas: input.notas || null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function updateEstadoProspecto(
  tenantId: string,
  id: string,
  nuevoEstado: ProspectoEstado
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("prospectos")
    .update({ estado: nuevoEstado })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function countProspectosNuevos(tenantId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("prospectos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("estado", "nuevo");

  if (error) return 0;
  return count ?? 0;
}

export async function countProspectosSinContactar(
  tenantId: string
): Promise<number> {
  const supabase = await createClient();

  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { count, error } = await supabase
    .from("prospectos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("estado", "nuevo")
    .lt("created_at", twentyFourHoursAgo);

  if (error) return 0;
  return count ?? 0;
}
