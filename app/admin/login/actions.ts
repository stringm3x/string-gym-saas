"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminLoginState {
  error: string | null;
}

/**
 * Login del super admin de STRING.
 *
 * Seguridad:
 * - Verifica credenciales Supabase Y presencia en `string_admins` activo.
 * - Si falla cualquiera de las dos: error GENÉRICO ("Acceso denegado"),
 *   nunca revela si el email existe ni si está/no en la tabla admin.
 * - Si no es admin, cierra la sesión recién abierta (no deja sesión a un
 *   usuario válido de Supabase que no sea admin).
 */
export async function loginAdmin(
  _prev: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError || !authData.user) {
    return { error: "Acceso denegado." };
  }

  // Verificar que sea super admin activo (policy de auto-lectura).
  const { data: admin } = await supabase
    .from("string_admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .eq("activo", true)
    .maybeSingle();

  if (!admin) {
    // Usuario Supabase válido pero NO admin: cerrar sesión + genérico.
    await supabase.auth.signOut();
    return { error: "Acceso denegado." };
  }

  // Marcar último acceso + registrar evento (best-effort, no bloqueante).
  await supabase.rpc("touch_admin_last_access");
  await supabase.rpc("log_admin_event", {
    p_accion: "admin.login",
    p_target_tenant_id: null,
    p_target_user_id: authData.user.id,
    p_metadata: {},
  });

  redirect("/admin");
}
