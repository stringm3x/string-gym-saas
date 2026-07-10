import { createClient } from "@/lib/supabase/server";
import type { MiembroInput } from "@/lib/validations/miembro.schema";
import type { Tag } from "@/lib/queries/tags.queries";
import { emitBienvenidaMiembro } from "@/lib/whatsapp/emit";

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
  archivado: boolean;
  archivado_at: string | null;
  plan_id: string | null;
  origen_importacion: string | null;
  created_at: string;
}

export interface MiembroConTags extends Miembro {
  tags: Tag[];
}

export interface MiembrosListParams {
  tenantId: string;
  search?: string;
  filter?: "all" | "activos" | "inactivos" | "por_vencer" | "sin_telefono";
  tagId?: string;
  /** Incluye archivados junto con los activos. */
  incluirArchivados?: boolean;
  /** Muestra únicamente los archivados. */
  soloArchivados?: boolean;
  /** Filtra por origen: manual (sin importar) o csv (importados). */
  origen?: "todos" | "manual" | "csv";
}

type MiembroRaw = Miembro & {
  miembros_tags: { tags: Tag | null }[];
};

export async function listMiembros({
  tenantId,
  search,
  filter = "all",
  tagId,
  incluirArchivados = false,
  soloArchivados = false,
  origen = "todos",
}: MiembrosListParams): Promise<MiembroConTags[]> {
  const supabase = await createClient();

  // Si hay filtro por tag, primero obtenemos los IDs de miembros con ese tag.
  let allowedIds: string[] | null = null;
  if (tagId) {
    const { data: tagged } = await supabase
      .from("miembros_tags")
      .select("miembro_id")
      .eq("tenant_id", tenantId)
      .eq("tag_id", tagId);

    allowedIds = (tagged ?? []).map((r) => r.miembro_id as string);
    if (allowedIds.length === 0) return [];
  }

  let query = supabase
    .from("miembros")
    .select("*, miembros_tags(tags(id, nombre, color, tenant_id, created_at))")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (origen === "manual") {
    query = query.is("origen_importacion", null);
  } else if (origen === "csv") {
    query = query.like("origen_importacion", "csv:%");
  }

  // Filtro de archivado: por default solo activos; soloArchivados invierte;
  // incluirArchivados no aplica filtro.
  if (soloArchivados) {
    query = query.eq("archivado", true);
  } else if (!incluirArchivados) {
    query = query.eq("archivado", false);
  }

  if (allowedIds !== null) {
    query = query.in("id", allowedIds);
  }

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
    const hoy = new Date();
    const en7 = new Date(hoy);
    en7.setDate(hoy.getDate() + 7);
    const isoHoy = hoy.toISOString().slice(0, 10);
    const iso7 = en7.toISOString().slice(0, 10);
    query = query
      .gte("fecha_vencimiento", isoHoy)
      .lte("fecha_vencimiento", iso7);
  } else if (filter === "sin_telefono") {
    // Sin teléfono usable: null, vacío o placeholder '0000000000'.
    query = query.or(
      "telefono.is.null,telefono.eq.,telefono.eq.0000000000"
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("listMiembros error:", error);
    return [];
  }

  return ((data ?? []) as unknown as MiembroRaw[]).map(
    ({ miembros_tags, ...rest }) => ({
      ...rest,
      tags: (miembros_tags ?? [])
        .map((mt) => mt.tags)
        .filter((t): t is Tag => t !== null),
    })
  );
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
  input: MiembroInput,
  planId?: string | null
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const payload = {
    tenant_id: tenantId,
    nombre: input.nombre,
    telefono: input.telefono || null,
    email: input.email || null,
    fecha_inscripcion: input.fecha_inscripcion,
    fecha_vencimiento: input.fecha_vencimiento || null,
    plan_id: planId ?? null,
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

  // WhatsApp (Fase 7.5): BIENVENIDA_MIEMBRO. Fire-and-forget, gateado y no-op
  // si la infra está dormida.
  void emitBienvenidaMiembro({
    tenantId,
    miembroId: data.id,
    planId: planId ?? null,
    fechaVencimiento: input.fecha_vencimiento || null,
  });

  return { ok: true, id: data.id };
}

/** Sets normalizados de teléfonos/emails existentes — para detectar duplicados. */
export async function getExistingContactos(
  tenantId: string
): Promise<{ telefonos: Set<string>; emails: Set<string> }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembros")
    .select("telefono, email")
    .eq("tenant_id", tenantId);

  const telefonos = new Set<string>();
  const emails = new Set<string>();
  for (const r of data ?? []) {
    if (r.telefono) telefonos.add(String(r.telefono).replace(/\D/g, ""));
    if (r.email) emails.add(String(r.email).trim().toLowerCase());
  }
  return { telefonos, emails };
}

export interface BulkMiembroRow {
  nombre: string;
  telefono: string | null;
  email: string | null;
  fecha_inscripcion: string;
  fecha_vencimiento: string | null;
  notas: string | null;
  plan_id: string | null;
}

export interface BulkCreateResult {
  successCount: number;
  failures: { index: number; error: string }[];
}

/**
 * Inserta miembros en bloque por chunks de 50. Si un chunk falla, reintenta
 * fila por fila para aislar y reportar las que fallan sin abortar todo.
 * `index` en `failures` es la posición en `rows` (0-indexed).
 */
export async function bulkCreateMiembros(
  tenantId: string,
  rows: BulkMiembroRow[],
  originId: string
): Promise<BulkCreateResult> {
  const supabase = await createClient();
  const CHUNK = 50;
  let successCount = 0;
  const failures: { index: number; error: string }[] = [];

  const toPayload = (r: BulkMiembroRow) => ({
    tenant_id: tenantId,
    nombre: r.nombre,
    telefono: r.telefono,
    email: r.email,
    fecha_inscripcion: r.fecha_inscripcion,
    fecha_vencimiento: r.fecha_vencimiento,
    notas: r.notas,
    plan_id: r.plan_id,
    origen_importacion: originId,
  });

  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);

    const { error } = await supabase.from("miembros").insert(chunk.map(toPayload));
    if (!error) {
      successCount += chunk.length;
      continue;
    }

    // El batch falló — aislar fila por fila.
    for (let i = 0; i < chunk.length; i++) {
      const { error: rowError } = await supabase
        .from("miembros")
        .insert(toPayload(chunk[i]));
      if (rowError) {
        failures.push({ index: start + i, error: rowError.message });
      } else {
        successCount += 1;
      }
    }
  }

  return { successCount, failures };
}

export async function updateMiembro(
  tenantId: string,
  id: string,
  input: MiembroInput,
  planId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const payload: Record<string, unknown> = {
    nombre: input.nombre,
    telefono: input.telefono || null,
    email: input.email || null,
    fecha_inscripcion: input.fecha_inscripcion,
    fecha_vencimiento: input.fecha_vencimiento || null,
  };
  // Solo tocar plan_id si se pasó explícitamente (no pisar en edición normal).
  if (planId !== undefined) {
    payload.plan_id = planId;
  }

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

export async function updateMiembroNotas(
  tenantId: string,
  id: string,
  notas: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("miembros")
    .update({ notas: notas || null })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function archivarMiembro(
  tenantId: string,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("miembros")
    .update({ archivado: true, archivado_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function restaurarMiembro(
  tenantId: string,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("miembros")
    .update({ archivado: false, archivado_at: null })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
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
    .eq("archivado", false)
    .eq("fecha_vencimiento", hoy);

  if (error) return 0;
  return count ?? 0;
}

/** Cuenta miembros activos sin teléfono usable (null, vacío o '0000000000'). */
export async function countMiembrosSinTelefono(
  tenantId: string
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("archivado", false)
    .or("telefono.is.null,telefono.eq.,telefono.eq.0000000000");

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
    .eq("archivado", false)
    .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
    .order("nombre")
    .limit(6);

  if (error) return [];
  return data ?? [];
}
