"use server";

import { redirect } from "next/navigation";
import { anonAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

/**
 * Cierra la sesión del usuario del tenant y vuelve al login. Anónima: el gym
 * puede estar suspendido o en prueba vencida, y aun así hay que poder salir.
 */
export const cerrarSesionAction = anonAction("cerrar_sesion_staff", async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
});
