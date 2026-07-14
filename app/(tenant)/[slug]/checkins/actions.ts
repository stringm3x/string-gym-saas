"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { createCheckin, bloqueaVencidos } from "@/lib/queries/checkins.queries";
import {
  searchMiembrosForCheckin,
  getMiembro,
} from "@/lib/queries/miembros.queries";
import { getEstadoMembresia } from "@/lib/utils/estado-membresia";

export interface CheckinResult {
  ok: boolean;
  error: string | null;
  /** true si NO se registró porque la política bloquea vencidos. */
  bloqueado?: boolean;
  miembro?: {
    id: string;
    nombre: string;
    estadoMembresia: string;
  };
}

export async function registerCheckinAction(
  miembroId: string
): Promise<CheckinResult> {
  const tenant = await getTenant();

  // Validar que el miembro pertenece al tenant (RLS ya lo hace, pero confirmamos).
  const miembro = await getMiembro(tenant.id, miembroId);
  if (!miembro) {
    return { ok: false, error: "Miembro no encontrado" };
  }

  const estado = getEstadoMembresia(miembro.fecha_vencimiento);

  // Política de vencidos: si el gym bloquea, no se registra el check-in.
  if (estado === "vencido" && (await bloqueaVencidos(tenant.id))) {
    return {
      ok: false,
      error: "Membresía vencida",
      bloqueado: true,
      miembro: {
        id: miembro.id,
        nombre: miembro.nombre,
        estadoMembresia: estado,
      },
    };
  }

  const result = await createCheckin(tenant.id, miembroId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/${tenant.slug}/checkins`);
  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);

  return {
    ok: true,
    error: null,
    miembro: {
      id: miembro.id,
      nombre: miembro.nombre,
      estadoMembresia: estado,
    },
  };
}

export async function searchMiembrosAction(query: string) {
  const tenant = await getTenant();
  return searchMiembrosForCheckin(tenant.id, query);
}
