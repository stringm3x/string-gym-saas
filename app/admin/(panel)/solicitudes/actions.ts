"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import {
  updateSolicitudEstado,
  activarSolicitud,
} from "@/lib/queries/solicitudes.queries";
import { sendCredencialesOwner } from "@/lib/email/solicitudes";

export interface SolicitudActionResult {
  ok: boolean;
  error?: string;
  slug?: string;
}

async function gate() {
  return getCurrentAdmin();
}

export async function contactadoAction(
  id: string
): Promise<SolicitudActionResult> {
  if (!(await gate())) return { ok: false, error: "No autorizado." };
  const r = await updateSolicitudEstado(id, "contactado");
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/solicitudes");
  return { ok: true };
}

export async function descartarAction(
  id: string
): Promise<SolicitudActionResult> {
  if (!(await gate())) return { ok: false, error: "No autorizado." };
  const r = await updateSolicitudEstado(id, "descartado");
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/solicitudes");
  return { ok: true };
}

export async function activarSolicitudAction(
  id: string
): Promise<SolicitudActionResult> {
  if (!(await gate())) return { ok: false, error: "No autorizado." };

  const r = await activarSolicitud(id);
  if (!r.ok) return { ok: false, error: r.error };

  // Email de bienvenida con credenciales (no bloquea).
  if (r.email && r.slug && r.nombreGym && r.tempPassword) {
    await sendCredencialesOwner({
      email: r.email,
      nombreGym: r.nombreGym,
      slug: r.slug,
      tempPassword: r.tempPassword,
    });
  }

  revalidatePath("/admin/solicitudes");
  return { ok: true, slug: r.slug };
}
