import { createClient } from "@/lib/supabase/server";
import type { MiembroInput } from "@/lib/validations/miembro.schema";

export interface Miembro {
  id: string;
  tenant_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  fecha_inscripcion: string;
  fecha_vencimiento: string | null;
  estado: "activo" | "inactivo";
  notas: string | null;
  created_at: string;
}

export interface MiembrosListParams {
  tenantId: string;
  search?: string;
  /**
   * Filtro de estado calculado en la query a partir de fecha_vencimiento
   * y la columna estado. 'all' devuelve todos.
   */
  filter?: "all" | "activos" | "inactivos" | "por_vencer";
}

export async function listMiembros({
  tenantId,
  search,
  filter = "all",
}: MiembrosListParams): Promise<Miembro[]> {
  const supabase = await createClient();

  let query = supabase
    .from("miembros")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (search && search.trim().length > 0) {
    const q = search.trim();
    query = query.or(
      `nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  if (filter === "activos") {
    query = query.eq("estado", "activo");
  } else if (filter === "inactivos") {
    query = query.eq("estado", "inactivo");
  } else if (filter === "por_vencer") {
    // Próximos 7 días, sin incluir vencidos.
    const hoy = new Date();
    const en7 = new Date(hoy);
    en7.setDate(hoy.getDate() + 7);
    const isoHoy = hoy.toISOString().slice(0, 10);
    const iso7 = en7.toISOString().slice(0, 10);
    query = query
      .gte("fecha_vencimiento", isoHoy)
      .lte("fecha_vencimiento", iso7);
  }

  const { data, error } = await query;

  if (error) {
    console.error("listMiembros error:", error);
    return [];
  }

  return data ?? [];
}

export async function getMiembro(
  tenantId: string,
  id: string
): Promise<Miembro | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("miembros")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createMiembro(
  tenantId: string,
  input: MiembroInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const payload = {
    tenant_id: tenantId,
    nombre: input.nombre,
    telefono: input.telefono || null,
    email: input.email || null,
    fecha_inscripcion: input.fecha_inscripcion,
    fecha_vencimiento: input.fecha_vencimiento || null,
    notas: input.notas || null,
  };

  const { data, error } = await supabase
    .from("miembros")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo crear el miembro",
    };
  }

  return { ok: true, id: data.id };
}

export async function updateMiembro(
  tenantId: string,
  id: string,
  input: MiembroInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const payload = {
    nombre: input.nombre,
    telefono: input.telefono || null,
    email: input.email || null,
    fecha_inscripcion: input.fecha_inscripcion,
    fecha_vencimiento: input.fecha_vencimiento || null,
    notas: input.notas || null,
  };

  const { error } = await supabase
    .from("miembros")
    .update(payload)
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Cuenta miembros que vencen hoy — para el badge ambiental de la sidebar.
 */
export async function countMiembrosVencenHoy(
  tenantId: string
): Promise<number> {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const { count, error } = await supabase
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("fecha_vencimiento", hoy);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Búsqueda rápida de miembros para el flujo de check-in (kiosco).
 * Limita a 6 resultados para mostrar como autocomplete.
 */
export async function searchMiembrosForCheckin(
  tenantId: string,
  query: string
): Promise<
  Pick<Miembro, "id" | "nombre" | "telefono" | "fecha_vencimiento">[]
> {
  if (!query || query.trim().length < 2) return [];

  const supabase = await createClient();
  const q = query.trim();

  const { data, error } = await supabase
    .from("miembros")
    .select("id, nombre, telefono, fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
    .order("nombre")
    .limit(6);

  if (error) return [];
  return data ?? [];
}
