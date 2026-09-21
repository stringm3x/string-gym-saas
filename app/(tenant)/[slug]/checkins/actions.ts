"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import {
  createCheckin,
  bloqueaVencidos,
  visitasAgotadas,
  checkinReciente,
} from "@/lib/queries/checkins.queries";
import {
  searchMiembrosForCheckin,
  getMiembro,
} from "@/lib/queries/miembros.queries";
import { congelacionActiva } from "@/lib/queries/miembro-eventos.queries";
import { getEstadoMembresia } from "@/lib/utils/estado-membresia";
import { getDeudaVencida } from "@/lib/queries/creditos.queries";

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
  /** Solo aviso, nunca bloquea (bloque 08): cuotas vencidas de un plan a plazos. */
  deudaVencida?: { monto: number; cuotas: number } | null;
}

export const registerCheckinAction = panelAction(
  "checkins.registrar",
  {},
  async (tenant, miembroId: string): Promise<CheckinResult> => {
    // Validar que el miembro pertenece al tenant (RLS ya lo hace, pero confirmamos).
    const miembro = await getMiembro(tenant.id, miembroId);
    if (!miembro) {
      return { ok: false, error: "Miembro no encontrado" };
    }

    const estado = getEstadoMembresia(miembro.fecha_vencimiento);

    // Check-in duplicado (D-bloque-01): mismo socio hace <2 min — evita que un
    // doble tap o un QR sostenido frente al lector genere entradas repetidas.
    if (await checkinReciente(tenant.id, miembroId)) {
      return {
        ok: false,
        error: "Ya registró su entrada hace un momento",
        bloqueado: true,
        miembro: { id: miembro.id, nombre: miembro.nombre, estadoMembresia: estado },
      };
    }

    // Sin visitas (D3): plan por visitas agotado.
    if (await visitasAgotadas(tenant.id, miembroId)) {
      return {
        ok: false,
        error: "Sin visitas disponibles",
        bloqueado: true,
        miembro: { id: miembro.id, nombre: miembro.nombre, estadoMembresia: estado },
      };
    }

    // Congelación (D1): bloqueo duro durante la pausa, sin importar la política.
    if (await congelacionActiva(tenant.id, miembroId)) {
      return {
        ok: false,
        error: "Membresía congelada",
        bloqueado: true,
        miembro: { id: miembro.id, nombre: miembro.nombre, estadoMembresia: estado },
      };
    }

    // Política de vencidos: si el gym bloquea, no se registra el check-in.
    // sin_membresia sigue la misma política que vencido — nunca hubo fecha
    // de vencimiento, así que tampoco hay nada que "avisar y dejar pasar".
    if (
      (estado === "vencido" || estado === "sin_membresia") &&
      (await bloqueaVencidos(tenant.id))
    ) {
      return {
        ok: false,
        error:
          estado === "sin_membresia"
            ? "Sin membresía registrada"
            : "Membresía vencida",
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
      deudaVencida: await getDeudaVencida(tenant.id, miembroId),
    };
  }
);

export const searchMiembrosAction = panelAction(
  "checkins.buscar",
  { onDenied: () => [] },
  async (tenant, query: string) => searchMiembrosForCheckin(tenant.id, query)
);
