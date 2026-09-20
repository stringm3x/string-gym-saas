"use server";

import { anonAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export interface RecuperarPasswordState {
  ok: boolean;
  error: string | null;
}

export const solicitarRecuperacion = anonAction(
  "recuperar_password",
  async (_prev: RecuperarPasswordState, formData: FormData): Promise<RecuperarPasswordState> => {
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
      return { ok: false, error: "Ingresa tu correo." };
    }

    const supabase = await createClient();
    const redirectTo = process.env.APP_DOMAIN
      ? `https://${process.env.APP_DOMAIN}/auth/nueva-password`
      : undefined;

    // No exponemos si el correo existe o no: siempre respondemos ok.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    return { ok: true, error: null };
  }
);
