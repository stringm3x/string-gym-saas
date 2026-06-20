"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFeature, type Plan } from "@/lib/features";

export interface LoginState {
  error: string | null;
}

/** Destino del owner según su plan (igual que el redirect raíz). */
function ownerDestino(slug: string, plan: Plan): string {
  return `/${slug}/${hasFeature(plan, "pantalla_hoy") ? "hoy" : "dashboard"}`;
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

  const userId = authData.user.id;

  // 1. ¿Es OWNER de un gym activo? (camino histórico, sin tocar staff)
  const { data: ownerGym } = await supabase
    .from("gyms")
    .select("slug, plan")
    .eq("owner_id", userId)
    .eq("estado", "activo")
    .maybeSingle();

  if (ownerGym) {
    redirect(ownerDestino(ownerGym.slug, ownerGym.plan as Plan));
  }

  // 2. ¿Es STAFF activo de un gym? (policy 012 permite leer la propia fila)
  const { data: staffRow } = await supabase
    .from("staff")
    .select("rol, gym_id")
    .eq("user_id", userId)
    .eq("estado", "activo")
    .limit(1)
    .maybeSingle();

  if (staffRow) {
    const { data: gym } = await supabase
      .from("gyms")
      .select("slug, plan, estado")
      .eq("id", staffRow.gym_id)
      .maybeSingle();

    if (gym && gym.estado === "activo") {
      // Recepcionista → su pantalla principal es check-ins.
      // (Un owner ya fue cubierto en el paso 1; defensivo por si acaso.)
      if (staffRow.rol === "owner") {
        redirect(ownerDestino(gym.slug, gym.plan as Plan));
      }
      redirect(`/${gym.slug}/checkins`);
    }
  }

  // 3. Ni owner ni staff activo.
  return {
    error: "Tu cuenta no tiene un gym activo asociado. Contacta a soporte.",
  };
}
