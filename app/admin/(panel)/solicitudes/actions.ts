"use server";

import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/authz";
import {
  updateSolicitudEstado,
  activarSolicitud,
} from "@/lib/queries/solicitudes.queries";
import { sendCredencialesOwner } from "@/lib/email/solicitudes";

export interface SolicitudActionResult {
  ok: boolean;
  error?: string;
  slug?: string;
  email?: string;
  tempPassword?: string;
  emailEnviado?: boolean;
}

export const contactadoAction = adminAction(
  "admin.solicitud_contactado",
  {},
  async (_ctx, id: string): Promise<SolicitudActionResult> => {
    const r = await updateSolicitudEstado(id, "contactado");
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath("/admin/solicitudes");
    return { ok: true };
  }
);

export const descartarAction = adminAction(
  "admin.solicitud_descartar",
  {},
  async (_ctx, id: string): Promise<SolicitudActionResult> => {
    const r = await updateSolicitudEstado(id, "descartado");
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath("/admin/solicitudes");
    return { ok: true };
  }
);

/** Crea el tenant en prueba y la cuenta del dueño, y envía las credenciales. */
export const activarSolicitudAction = adminAction(
  "admin.solicitud_activar",
  {},
  async (_ctx, id: string): Promise<SolicitudActionResult> => {
    const r = await activarSolicitud(id);
    if (!r.ok) return { ok: false, error: r.error };

    // Email de bienvenida con credenciales (no bloquea la activación, pero su
    // resultado sí se reporta — si falla, el admin necesita las credenciales
    // para compartirlas manualmente).
    let emailEnviado = false;
    if (r.email && r.slug && r.nombreGym && r.tempPassword) {
      emailEnviado = await sendCredencialesOwner({
        email: r.email,
        nombreGym: r.nombreGym,
        slug: r.slug,
        tempPassword: r.tempPassword,
      });
    }

    revalidatePath("/admin/solicitudes");
    return {
      ok: true,
      slug: r.slug,
      email: r.email,
      tempPassword: r.tempPassword,
      emailEnviado,
    };
  }
);
