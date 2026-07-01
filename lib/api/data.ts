import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/utils/notifications";

export interface GymPublic {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_acento: string | null;
  telefono: string | null;
  direccion: string | null;
}

/** Info pública del gym por slug (para GET /info, sin API key). */
export async function apiGetGymPublic(
  slug: string,
  admin: SupabaseClient
): Promise<GymPublic | null> {
  const { data } = await admin
    .from("gyms")
    .select("id, nombre, slug, logo_url, color_acento, telefono, direccion")
    .eq("slug", slug)
    .maybeSingle();
  return (data as GymPublic | null) ?? null;
}

/** Crea un prospecto con origen 'api' (requiere migración 027). */
export async function apiCreateProspecto(
  tenantId: string,
  input: {
    nombre: string;
    telefono: string;
    email?: string;
    mensaje?: string;
    origenDetalle?: string;
  },
  admin: SupabaseClient
): Promise<{ id: string | null; error?: string }> {
  const notaPartes: string[] = [];
  if (input.mensaje) notaPartes.push(input.mensaje);
  if (input.origenDetalle) notaPartes.push(`(origen: ${input.origenDetalle})`);
  const notas = notaPartes.join(" ") || null;

  const { data, error } = await admin
    .from("prospectos")
    .insert({
      tenant_id: tenantId,
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email || null,
      origen: "api",
      estado: "nuevo",
      notas,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message };

  // Notificación in-app al gym (Fase 7.3).
  await createNotification(
    tenantId,
    "prospecto",
    `Nuevo prospecto: ${input.nombre}`,
    input.mensaje,
    "prospectos"
  );

  return { id: data.id };
}
