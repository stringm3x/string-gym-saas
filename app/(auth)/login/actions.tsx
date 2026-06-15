"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
}

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    return { error: "Credenciales incorrectas." };
  }

  // Buscar el gym asociado al usuario para redirigir a su panel.
  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .select("slug")
    .eq("owner_id", authData.user.id)
    .eq("estado", "activo")
    .single();

  if (gymError || !gym) {
    return {
      error: "Tu cuenta no tiene un gym activo asociado. Contacta a soporte.",
    };
  }

  redirect(`/${gym.slug}/dashboard`);
}
