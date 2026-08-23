import { createClient } from "@/lib/supabase/server";
import type { MiembroInput } from "@/lib/validations/miembro.schema";
import type { Tag } from "@/lib/queries/tags.queries";
import { emitBienvenidaMiembro } from "@/lib/whatsapp/emit";
import { hoyISO, isoMasDias } from "@/lib/utils/dates";

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
  visitas_restantes: number | null;
  origen_importacion: string | null;
  fecha_nacimiento: string | null;
  referido_por: string | null;
  created_at: string;
}

export interface MiembroConTags extends Miembro {
  tags: Tag[];
}

export interface MiembrosListParams {
  tenantId: string;
  search?: string;
  filter?: "all" | "activos" | "inactivos" | "por_vencer" | "sin_telefono";
  /** Uno o más tags — semántica OR (miembro tiene AL MENOS uno de estos). */
  tagIds?: string[];
  /** Incluye archivados junto con los activos. */
  incluirArchivados?: boolean;
  /** Muestra únicamente los archivados. */
  soloArchivados?: boolean;
  /** Filtra por origen: manual (sin importar) o csv (importados). */
  origen?: "todos" | "manual" | "csv";
  /** Página 1-based. Default 1. */
  page?: number;
  /** Miembros por página. Default 50. */
  pageSize?: number;
}

export interface MiembrosListResult {
  miembros: MiembroConTags[];
  total: number;
  page: number;
  pageSize: number;
}

type MiembroRaw = Miembro & {
  miembros_tags: { tags: Tag | null }[];
};

export async function listMiembros({
  tenantId,
  search,
  filter = "all",
  tagIds,
  incluirArchivados = false,
  soloArchivados = false,
  origen = "todos",
  page = 1,
  pageSize = 50,
}: MiembrosListParams): Promise<MiembrosListResult> {
  const supabase = await createClient();
  const paginaActual = Math.max(1, page);
  const from = (paginaActual - 1) * pageSize;
  const to = from + pageSize - 1;
  const vacio: MiembrosListResult = {
    miembros: [],
    total: 0,
    page: paginaActual,
    pageSize,
  };

  // Si hay filtro por tags, primero obtenemos los IDs de miembros con
  // alguno de esos tags (OR — "tiene el tag A o el tag B").
  let allowedIds: string[] | null = null;
  if (tagIds && tagIds.length > 0) {
    const { data: tagged } = await supabase
      .from("miembros_tags")
      .select("miembro_id")
      .eq("tenant_id", tenantId)
      .in("tag_id", tagIds);

    allowedIds = [...new Set((tagged ?? []).map((r) => r.miembro_id as string))];
    if (allowedIds.length === 0) return vacio;
  }

  let query = supabase
    .from("miembros")
    .select(
      "*, miembros_tags(tags(id, nombre, color, tenant_id, created_at))",
      { count: "exact" }
    )
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

  // Fuente de verdad del estado: fecha_vencimiento (CDMX), igual que el
  // dashboard y el badge. La columna `estado` quedó vestigial y no se
  // sincroniza al vencer, así que NO se usa aquí.
  if (filter === "activos") {
    // Vigente: vence hoy o después.
    query = query.gte("fecha_vencimiento", hoyISO());
  } else if (filter === "inactivos") {
    // Vencido o sin membresía registrada.
    query = query.or(
      `fecha_vencimiento.lt.${hoyISO()},fecha_vencimiento.is.null`
    );
  } else if (filter === "por_vencer") {
    query = query
      .gte("fecha_vencimiento", hoyISO())
      .lte("fecha_vencimiento", isoMasDias(7));
  } else if (filter === "sin_telefono") {
    // Sin teléfono usable: null, vacío o placeholder '0000000000'.
    query = query.or(
      "telefono.is.null,telefono.eq.,telefono.eq.0000000000"
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("listMiembros error:", error);
    return vacio;
  }

  const miembros = ((data ?? []) as unknown as MiembroRaw[]).map(
    ({ miembros_tags, ...rest }) => ({
      ...rest,
      tags: (miembros_tags ?? [])
        .map((mt) => mt.tags)
        .filter((t): t is Tag => t !== null),
    })
  );

  return { miembros, total: count ?? miembros.length, page: paginaActual, pageSize };
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
    fecha_nacimiento: input.fecha_nacimiento || null,
    referido_por: input.referido_por || null,
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

export interface ReferidoLite {
  id: string;
  nombre: string;
}

/** Miembros no archivados que este miembro refirió (D — programa de referidos). */
export async function listReferidos(
  tenantId: string,
  miembroId: string
): Promise<ReferidoLite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembros")
    .select("id, nombre")
    .eq("tenant_id", tenantId)
    .eq("referido_por", miembroId)
    .eq("archivado", false)
    .order("nombre");
  return (data ?? []) as ReferidoLite[];
}

export interface MiembroDuplicado {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
}

/**
 * Busca un miembro no archivado con el mismo teléfono, correo o nombre
 * (normalizados) — para advertir antes de crear un posible duplicado.
 */
export async function findMiembroDuplicado(
  tenantId: string,
  input: { nombre: string; telefono?: string; email?: string }
): Promise<MiembroDuplicado | null> {
  const nombreNorm = input.nombre.trim().toLowerCase();
  const telefonoNorm = input.telefono ? input.telefono.replace(/\D/g, "") : "";
  const emailNorm = input.email ? input.email.trim().toLowerCase() : "";
  if (!nombreNorm && !telefonoNorm && !emailNorm) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("miembros")
    .select("id, nombre, telefono, email")
    .eq("tenant_id", tenantId)
    .eq("archivado", false);

  for (const r of data ?? []) {
    const rTelefono = r.telefono ? String(r.telefono).replace(/\D/g, "") : "";
    const rEmail = r.email ? String(r.email).trim().toLowerCase() : "";
    const rNombre = String(r.nombre ?? "").trim().toLowerCase();
    if (
      (telefonoNorm && rTelefono && rTelefono === telefonoNorm) ||
      (emailNorm && rEmail && rEmail === emailNorm) ||
      (nombreNorm && rNombre === nombreNorm)
    ) {
      return { id: r.id, nombre: r.nombre, telefono: r.telefono, email: r.email };
    }
  }
  return null;
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
    fecha_nacimiento: input.fecha_nacimiento || null,
    referido_por: input.referido_por || null,
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
