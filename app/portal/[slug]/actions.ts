"use server";

import { redirect } from "next/navigation";
import { anonAction } from "@/lib/authz";
import { eliminarSession } from "@/lib/queries/portal.queries";
import { getPortalToken, clearPortalCookie } from "@/lib/portal/session";

/**
 * Cierra la sesión del portal y vuelve al login. Anónima a propósito: debe
 * borrar la cookie aunque la sesión ya haya expirado.
 */
export const cerrarSesionPortalAction = anonAction(
  "cerrar_sesion_portal",
  async (slug: string) => {
    const token = await getPortalToken();
    if (token) await eliminarSession(token);
    await clearPortalCookie();
    redirect(`/portal/${slug}/login`);
  }
);
