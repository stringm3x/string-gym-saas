"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/admin/helpers";

export interface CuentaResult {
  ok: boolean;
  error?: string;
}

/** Envía al admin actual un email de recuperación para cambiar su password. */
export async function cambiarPasswordAction(): Promise<CuentaResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "Acceso denegado." };

  const supabase = await createClient();
  const redirectTo = process.env.ADMIN_DOMAIN
    ? `https://${process.env.ADMIN_DOMAIN}/login`
    : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(admin.email, {
    redirectTo,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Cierra TODAS las sesiones del admin (scope global) y vuelve al login. */
export async function cerrarTodasSesionesAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/admin/login");
}
