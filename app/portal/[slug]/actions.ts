"use server";

import { redirect } from "next/navigation";
import { eliminarSession } from "@/lib/queries/portal.queries";
import { getPortalToken, clearPortalCookie } from "@/lib/portal/session";

/** Cierra la sesión del portal y vuelve al login. */
export async function cerrarSesionPortalAction(slug: string) {
  const token = await getPortalToken();
  if (token) await eliminarSession(token);
  await clearPortalCookie();
  redirect(`/portal/${slug}/login`);
}
