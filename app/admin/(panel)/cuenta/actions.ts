"use server";

import { redirect } from "next/navigation";
import { adminAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export interface CuentaResult {
  ok: boolean;
  error?: string;
}

/** Envía al admin actual un email de recuperación para cambiar su password. */
export const cambiarPasswordAction = adminAction(
  "admin.cambiar_password",
  {},
  async ({ admin }): Promise<CuentaResult> => {
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
);

/** Cierra TODAS las sesiones del admin (scope global) y vuelve al login. */
export const cerrarTodasSesionesAction = adminAction(
  "admin.cerrar_sesiones",
  {
    // Sin sesión de admin no hay nada que cerrar: al login de todos modos.
    onDenied: () => {
      redirect("/admin/login");
    },
  },
  async () => {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" });
    redirect("/admin/login");
  }
);
