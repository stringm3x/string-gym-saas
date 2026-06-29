import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SolicitudEstado =
  | "nuevo"
  | "contactado"
  | "activado"
  | "descartado";

export interface Solicitud {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  nombre_gym: string | null;
  plan_interes: string | null;
  ciudad: string | null;
  miembros_aprox: number | null;
  como_entero: string | null;
  notas: string | null;
  estado: SolicitudEstado;
  created_at: string;
}

const COLS =
  "id, nombre, email, telefono, nombre_gym, plan_interes, ciudad, miembros_aprox, como_entero, notas, estado, created_at";

export async function getSolicitudes(filtros?: {
  estado?: string;
}): Promise<Solicitud[]> {
  const admin = createAdminClient();
  let q = admin
    .from("solicitudes_prueba")
    .select(COLS)
    .order("created_at", { ascending: false });
  if (filtros?.estado) q = q.eq("estado", filtros.estado);
  const { data } = await q;
  return (data ?? []) as Solicitud[];
}

export async function createSolicitud(input: {
  nombre: string;
  email: string;
  telefono?: string;
  nombre_gym?: string;
  plan_interes?: string;
  ciudad?: string;
  miembros_aprox?: number;
  como_entero?: string;
  notas?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("solicitudes_prueba")
    .insert({
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono || null,
      nombre_gym: input.nombre_gym || null,
      plan_interes: input.plan_interes || null,
      ciudad: input.ciudad || null,
      miembros_aprox: input.miembros_aprox ?? null,
      como_entero: input.como_entero || null,
      notas: input.notas || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message };
  return { ok: true, id: data.id };
}

export async function updateSolicitudEstado(
  id: string,
  estado: SolicitudEstado
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("solicitudes_prueba")
    .update({ estado })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────── activar ───────────────────────────

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "gym"
  );
}

async function slugUnico(admin: SupabaseClient, base: string): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidato = i === 0 ? root : `${root}-${i + 1}`;
    const { data } = await admin
      .from("gyms")
      .select("id")
      .eq("slug", candidato)
      .maybeSingle();
    if (!data) return candidato;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

/** Contraseña temporal legible (sin caracteres ambiguos). */
function tempPassword(): string {
  return "Sg" + randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
}

export interface ActivarResult {
  ok: boolean;
  error?: string;
  slug?: string;
  email?: string;
  nombreGym?: string;
  tempPassword?: string;
}

/**
 * Activa una solicitud: crea el owner en Supabase Auth y el gym (tenant). El
 * trigger create_owner_staff genera el staff owner. Devuelve las credenciales
 * para que el caller envíe el email de bienvenida. Rollback del usuario si el
 * insert del gym falla.
 */
export async function activarSolicitud(id: string): Promise<ActivarResult> {
  const admin = createAdminClient();

  const { data: sol } = await admin
    .from("solicitudes_prueba")
    .select("id, nombre, email, nombre_gym, plan_interes, estado")
    .eq("id", id)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitud no encontrada." };
  if (sol.estado === "activado") {
    return { ok: false, error: "La solicitud ya fue activada." };
  }

  const nombreGym = sol.nombre_gym || sol.nombre;
  const plan = ["basico", "pro", "escala"].includes(sol.plan_interes)
    ? sol.plan_interes
    : "pro";
  const pass = tempPassword();

  // 1. Owner en Auth.
  const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
    email: sol.email,
    password: pass,
    email_confirm: true,
  });
  if (userErr || !userRes.user) {
    return {
      ok: false,
      error:
        userErr?.message?.includes("registered") || userErr?.code === "email_exists"
          ? "Ya existe un usuario con ese email."
          : (userErr?.message ?? "No se pudo crear el usuario."),
    };
  }
  const ownerId = userRes.user.id;

  // 2. Gym (trigger create_owner_staff crea el staff owner).
  const slug = await slugUnico(admin, nombreGym);
  const { data: gym, error: gymErr } = await admin
    .from("gyms")
    .insert({
      nombre: nombreGym,
      slug,
      owner_id: ownerId,
      plan,
      estado: "activo",
    })
    .select("id, slug")
    .single();
  if (gymErr || !gym) {
    await admin.auth.admin.deleteUser(ownerId); // rollback
    return { ok: false, error: gymErr?.message ?? "No se pudo crear el gym." };
  }

  // 3. Marcar solicitud como activada.
  await admin.from("solicitudes_prueba").update({ estado: "activado" }).eq("id", id);

  return {
    ok: true,
    slug: gym.slug,
    email: sol.email,
    nombreGym,
    tempPassword: pass,
  };
}
