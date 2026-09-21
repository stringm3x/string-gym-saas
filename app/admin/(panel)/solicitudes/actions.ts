"use server";

import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/authz";
import {
  updateSolicitudEstado,
  activarSolicitud,
} from "@/lib/queries/solicitudes.queries";
import { sendInvitacionOwner } from "@/lib/email/solicitudes";

export interface SolicitudActionResult {
  ok: boolean;
  error?: string;
  slug?: string;
  email?: string;
  inviteLink?: string;
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

    // Email de bienvenida con el enlace de invitación (no bloquea la
    // activación, pero su resultado sí se reporta — si falla, el admin
    // necesita el enlace para compartirlo manualmente).
    let emailEnviado = false;
    if (r.email && r.slug && r.nombreGym && r.inviteLink) {
      emailEnviado = await sendInvitacionOwner({
        email: r.email,
        nombreGym: r.nombreGym,
        slug: r.slug,
        inviteLink: r.inviteLink,
      });
    }

    revalidatePath("/admin/solicitudes");
    return {
      ok: true,
      slug: r.slug,
      email: r.email,
      inviteLink: r.inviteLink,
      emailEnviado,
    };
  }
);
