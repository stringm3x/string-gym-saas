import { createClient } from "@/lib/supabase/server";
import type { ProspectoEstado, ProspectoInput } from "@/lib/validations/prospecto.schema";
import type { Tag } from "@/lib/queries/tags.queries";
import { emitProspectoNuevo } from "@/lib/whatsapp/emit";

export interface Prospecto {
  id: string;
  tenant_id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  origen: "landing" | "whatsapp" | "referido" | "manual" | "clase_gratis" | "api";
  estado: ProspectoEstado;
  fecha_prueba_agendada: string | null;
  notas: string | null;
  created_at: string;
}

export interface ProspectoConTags extends Prospecto {
  tags: Tag[];
}

export interface ListProspectosOptions {
  estado?: ProspectoEstado;
  search?: string;
}

type ProspectoRaw = Prospecto & {
  prospectos_tags: { tags: Tag | null }[];
};

export async function listProspectos(
  tenantId: string,
  options?: ListProspectosOptions
): Promise<ProspectoConTags[]> {
  const supabase = await createClient();

  let query = supabase
    .from("prospectos")
    .select(
      "*, prospectos_tags(tags(id, nombre, color, tenant_id, created_at))"
    )
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

  return ((data ?? []) as unknown as ProspectoRaw[]).map(
    ({ prospectos_tags, ...rest }) => ({
      ...rest,
      tags: (prospectos_tags ?? [])
        .map((pt) => pt.tags)
        .filter((t): t is Tag => t !== null),
    })
  );
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

  // WhatsApp (Fase 7.5): PROSPECTO_NUEVO al owner. Fire-and-forget, gateado y
  // no-op si la infra está dormida. Los prospectos no tienen plan de interés.
  void emitProspectoNuevo({
    tenantId,
    prospectoNombre: input.nombre,
    prospectoTelefono: input.telefono ?? null,
    planInteres: null,
    origen: input.origen,
  });

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
