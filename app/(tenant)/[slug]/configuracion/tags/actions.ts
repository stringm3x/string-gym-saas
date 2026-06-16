"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import {
  createTag,
  updateTag,
  deleteTag,
} from "@/lib/queries/tags.queries";
import { tagSchema } from "@/lib/validations/tag.schema";

export interface TagFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

const empty: TagFormState = { ok: false, error: null, fieldErrors: {} };

function parseFormData(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    color: String(formData.get("color") ?? "neutral"),
  };
}

function collectFieldErrors(
  issues: { path: PropertyKey[]; message: string }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    const path = key !== undefined ? String(key) : undefined;
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

export async function createTagAction(
  _prev: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  const tenant = await getTenant();
  const raw = parseFormData(formData);

  const parsed = tagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const result = await createTag(tenant.id, parsed.data);
  if (!result.ok) return { ...empty, error: result.error };

  revalidatePath(`/${tenant.slug}/configuracion/tags`);
  return { ok: true, error: null, fieldErrors: {} };
}

export async function updateTagAction(
  id: string,
  _prev: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  const tenant = await getTenant();
  const raw = parseFormData(formData);

  const parsed = tagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const result = await updateTag(tenant.id, id, parsed.data);
  if (!result.ok) return { ...empty, error: result.error };

  revalidatePath(`/${tenant.slug}/configuracion/tags`);
  return { ok: true, error: null, fieldErrors: {} };
}

export async function deleteTagAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  const result = await deleteTag(tenant.id, id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/${tenant.slug}/configuracion/tags`);
  return { ok: true };
}
