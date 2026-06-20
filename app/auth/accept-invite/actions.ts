"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptInviteSchema } from "@/lib/validations/staff.schema";

export interface AcceptInviteResult {
  ok: boolean;
  error?: string;
  slug?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export interface InviteStatus {
  exists: boolean;
  alreadyActive: boolean;
  /** La sesión activa (si la hay) corresponde al user_id del registro. */
  userIdMatches: boolean;
  /** Hay una sesión activa en el navegador. */
  hasSession: boolean;
}

/**
 * Diagnóstico del estado de una invitación SIN RLS (admin client) para
 * distinguir casos: cancelada, ya aceptada, o sesión de otra cuenta.
 */
export async function checkInviteStatusAction(
  staffId: string
): Promise<InviteStatus> {
  const safe: InviteStatus = {
    exists: false,
    alreadyActive: false,
    userIdMatches: false,
    hasSession: false,
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    safe.hasSession = Boolean(user);

    // staffId vacío/nulo → no consultar (evita uuid inválido en Postgres).
    if (!staffId) return { ...safe };

    const admin = createAdminClient();
    const { data: staff, error } = await admin
      .from("staff")
      .select("user_id, estado")
      .eq("id", staffId)
      .maybeSingle();

    // Error de query (ej. uuid inválido 22P02) o no encontrado → fallback seguro.
    if (error || !staff) return { ...safe };

    return {
      exists: true,
      alreadyActive: staff.estado === "activo",
      userIdMatches: Boolean(user) && staff.user_id === user!.id,
      hasSession: Boolean(user),
    };
  } catch {
    return safe;
  }
}

/**
 * Completa la aceptación de una invitación:
 *  1. Verifica que el usuario autenticado (sesión de la invitación) es el
 *     dueño del registro staff y que sigue en estado 'invitado'.
 *  2. Asigna la contraseña al usuario (Admin API).
 *  3. Activa el registro staff (estado='activo').
 *
 * Las escrituras usan el admin client porque la RLS de `staff` solo deja
 * UPDATE al owner; aquí escribe el propio invitado de forma controlada.
 */
export async function acceptInviteAction(
  staffId: string,
  nombre: string,
  password: string
): Promise<AcceptInviteResult> {
  // 1. Sesión del invitado (establecida por el link de invitación).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sesión inválida o expirada. Abre el link del email de nuevo." };
  }

  const parsed = acceptInviteSchema.safeParse({ nombre, password });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const path = key !== undefined ? String(key) : undefined;
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const admin = createAdminClient();

  // 2. Validar el registro staff: debe ser de ESTE usuario y estar invitado.
  const { data: staff } = await admin
    .from("staff")
    .select("id, gym_id, user_id, estado")
    .eq("id", staffId)
    .maybeSingle();

  if (!staff || staff.user_id !== user.id) {
    return { ok: false, error: "Invitación no válida para esta cuenta." };
  }
  if (staff.estado === "activo") {
    // Ya estaba activo — resolver el slug y dejar pasar.
    const { data: gym } = await admin
      .from("gyms")
      .select("slug")
      .eq("id", staff.gym_id)
      .single();
    return { ok: true, slug: gym?.slug };
  }
  if (staff.estado !== "invitado") {
    return { ok: false, error: "Esta invitación ya no está disponible." };
  }

  // 3. Asignar contraseña.
  const { error: pwError } = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data.password,
  });
  if (pwError) {
    return { ok: false, error: pwError.message };
  }

  // 4. Activar el staff.
  const now = new Date().toISOString();
  const { error: updError } = await admin
    .from("staff")
    .update({
      estado: "activo",
      nombre: parsed.data.nombre,
      activado_at: now,
      ultima_sesion_at: now,
    })
    .eq("id", staff.id);
  if (updError) {
    return { ok: false, error: updError.message };
  }

  const { data: gym } = await admin
    .from("gyms")
    .select("slug")
    .eq("id", staff.gym_id)
    .single();

  return { ok: true, slug: gym?.slug };
}
