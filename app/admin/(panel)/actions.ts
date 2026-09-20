"use server";

import { redirect } from "next/navigation";
import { anonAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión del admin y vuelve al login. Anónima: debe funcionar aunque la sesión ya no sea de admin. */
export const logoutAdmin = anonAction("cerrar_sesion_admin", async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
});
