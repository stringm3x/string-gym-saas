"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión del usuario del tenant y vuelve al login. */
export async function cerrarSesionAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
