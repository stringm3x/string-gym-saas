"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { updateGymMarca, updateGymLogo } from "@/lib/queries/marca.queries";
import { updateGooglePlaceId } from "@/lib/queries/opiniones.queries";
import {
  marcaColoresSchema,
  LOGO_MAX_BYTES,
  LOGO_TIPOS_PERMITIDOS,
  LOGO_EXT_BY_MIME,
} from "@/lib/validations/marca.schema";

const BUCKET = "gym-logos";

export interface MarcaFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

/** Guarda el Google Place ID del gym (para las reseñas de Google). */
export const guardarGooglePlaceIdAction = panelAction(
  "config.google_place_id",
  {},
  async (tenant, placeId: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await updateGooglePlaceId(tenant.id, placeId);
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath(`/${tenant.slug}/configuracion/marca`);
    return { ok: true };
  }
);

export const updateMarcaAction = panelAction(
  "config.marca_color",
  { onDenied: (d) => ({ ok: false, error: d.error, fieldErrors: {} }) },
  async (tenant, _prev: MarcaFormState, formData: FormData): Promise<MarcaFormState> => {
    const parsed = marcaColoresSchema.safeParse({
      color_acento: String(formData.get("color_acento") ?? ""),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        const path = key !== undefined ? String(key) : undefined;
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }

    const result = await updateGymMarca(tenant.id, parsed.data);
    if (!result.ok) {
      return { ok: false, error: result.error ?? "Error al guardar.", fieldErrors: {} };
    }

    revalidatePath(`/${tenant.slug}`, "layout");
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const uploadLogoAction = panelAction(
  "config.logo_subir",
  {},
  async (tenant, formData: FormData): Promise<{ ok: boolean; url?: string; error?: string }> => {
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "No se recibió ningún archivo." };
    }

    if (!LOGO_TIPOS_PERMITIDOS.includes(file.type as (typeof LOGO_TIPOS_PERMITIDOS)[number])) {
      return { ok: false, error: "Tipo de archivo no permitido." };
    }
    if (file.size > LOGO_MAX_BYTES) {
      return { ok: false, error: "El archivo supera el máximo de 2MB." };
    }

    const ext = LOGO_EXT_BY_MIME[file.type];
    const path = `${tenant.id}/logo.${ext}`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      return { ok: false, error: uploadError.message };
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // Cache-bust: el archivo se sobreescribe con el mismo nombre.
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const updateResult = await updateGymLogo(tenant.id, url);
    if (!updateResult.ok) {
      return { ok: false, error: updateResult.error };
    }

    revalidatePath(`/${tenant.slug}`, "layout");
    return { ok: true, url };
  }
);

export const deleteLogoAction = panelAction(
  "config.logo_borrar",
  {},
  async (tenant): Promise<{ ok: boolean; error?: string }> => {
    const supabase = await createClient();

    // Borrar cualquier archivo logo.* dentro de la carpeta del gym.
    const { data: files } = await supabase.storage.from(BUCKET).list(tenant.id);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${tenant.id}/${f.name}`);
      await supabase.storage.from(BUCKET).remove(paths);
    }

    const result = await updateGymLogo(tenant.id, null);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/${tenant.slug}`, "layout");
    return { ok: true };
  }
);
