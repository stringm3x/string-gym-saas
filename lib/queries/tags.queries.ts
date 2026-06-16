import { createClient } from "@/lib/supabase/server";
import type { TagInput, TagColor } from "@/lib/validations/tag.schema";

export interface Tag {
  id: string;
  tenant_id: string;
  nombre: string;
  color: TagColor;
  created_at: string;
}

export interface TagConConteo extends Tag {
  miembros_count: number;
  prospectos_count: number;
}

// ─── Catálogo ────────────────────────────────────────────────

export async function listTags(tenantId: string): Promise<Tag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");

  if (error) {
    console.error("listTags error:", error);
    return [];
  }
  return (data ?? []) as Tag[];
}

export async function listTagsConConteo(
  tenantId: string
): Promise<TagConConteo[]> {
  const supabase = await createClient();

  const [tagsRes, mRes, pRes] = await Promise.all([
    supabase.from("tags").select("*").eq("tenant_id", tenantId).order("nombre"),
    supabase
      .from("miembros_tags")
      .select("tag_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("prospectos_tags")
      .select("tag_id")
      .eq("tenant_id", tenantId),
  ]);

  const mCounts = new Map<string, number>();
  for (const row of mRes.data ?? []) {
    mCounts.set(row.tag_id, (mCounts.get(row.tag_id) ?? 0) + 1);
  }

  const pCounts = new Map<string, number>();
  for (const row of pRes.data ?? []) {
    pCounts.set(row.tag_id, (pCounts.get(row.tag_id) ?? 0) + 1);
  }

  return ((tagsRes.data ?? []) as Tag[]).map((tag) => ({
    ...tag,
    miembros_count: mCounts.get(tag.id) ?? 0,
    prospectos_count: pCounts.get(tag.id) ?? 0,
  }));
}

export async function createTag(
  tenantId: string,
  input: TagInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .insert({ tenant_id: tenantId, nombre: input.nombre, color: input.color })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Ya existe un tag con ese nombre." };
    }
    return { ok: false, error: error?.message ?? "No se pudo crear el tag." };
  }
  return { ok: true, id: data.id };
}

export async function updateTag(
  tenantId: string,
  id: string,
  input: TagInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tags")
    .update({ nombre: input.nombre, color: input.color })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un tag con ese nombre." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteTag(
  tenantId: string,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Asignación ──────────────────────────────────────────────

export async function syncTagsForMiembro(
  tenantId: string,
  miembroId: string,
  tagIds: string[]
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("miembros_tags")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId);

  if (tagIds.length > 0) {
    await supabase.from("miembros_tags").insert(
      tagIds.map((tag_id) => ({
        miembro_id: miembroId,
        tag_id,
        tenant_id: tenantId,
      }))
    );
  }
}

export async function syncTagsForProspecto(
  tenantId: string,
  prospectoId: string,
  tagIds: string[]
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("prospectos_tags")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("prospecto_id", prospectoId);

  if (tagIds.length > 0) {
    await supabase.from("prospectos_tags").insert(
      tagIds.map((tag_id) => ({
        prospecto_id: prospectoId,
        tag_id,
        tenant_id: tenantId,
      }))
    );
  }
}

export async function getTagsForMiembro(
  tenantId: string,
  miembroId: string
): Promise<Tag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("miembros_tags")
    .select("tags(*)")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId);

  if (error || !data) return [];
  return data
    .map((row) => (row.tags as unknown) as Tag | null)
    .filter((t): t is Tag => t !== null);
}

export async function getTagsForProspecto(
  tenantId: string,
  prospectoId: string
): Promise<Tag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prospectos_tags")
    .select("tags(*)")
    .eq("tenant_id", tenantId)
    .eq("prospecto_id", prospectoId);

  if (error || !data) return [];
  return data
    .map((row) => (row.tags as unknown) as Tag | null)
    .filter((t): t is Tag => t !== null);
}
