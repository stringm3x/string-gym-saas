"use server";

import { panelAction } from "@/lib/authz";
import { getMiembroByQrToken } from "@/lib/queries/qr.queries";
import {
  createCheckin,
  bloqueaVencidos,
  visitasAgotadas,
  checkinReciente,
} from "@/lib/queries/checkins.queries";
import { congelacionActiva } from "@/lib/queries/miembro-eventos.queries";
import { getDeudaVencida } from "@/lib/queries/creditos.queries";
import { hoyISO } from "@/lib/utils/dates";

export type CheckInQrError =
  | "QR_NO_ENCONTRADO"
  | "MIEMBRO_ARCHIVADO"
  | "MEMBRESIA_VENCIDA"
  | "MEMBRESIA_CONGELADA"
  | "SIN_VISITAS"
  | "CHECKIN_RECIENTE"
  | "ERROR";

export type CheckInQrResult =
  | {
      success: true;
      nombre: string;
      fechaVencimiento: string | null;
      /** true si se dejó pasar con membresía vencida/sin registrar (política "solo avisar"). */
      avisoVencido: boolean;
      /** Solo aviso, nunca bloquea (bloque 08): cuotas vencidas de un plan a plazos. */
      deudaVencida: { monto: number; cuotas: number } | null;
    }
  | { success: false; error: CheckInQrError; nombre?: string };

/**
 * Check-in por token de QR del scanner del staff (operación diaria de los
 * cuatro roles). El lookup es acotado por tenant → un token de otro gym no
 * se encuentra (tenant isolation).
 */
export const checkInPorQrAction = panelAction(
  "checkins.qr",
  { onDenied: (): CheckInQrResult => ({ success: false, error: "ERROR" }) },
  async (tenant, token: string): Promise<CheckInQrResult> => {
    const t = (token || "").trim();
    if (!t) return { success: false, error: "QR_NO_ENCONTRADO" };

    const miembro = await getMiembroByQrToken(tenant.id, t);
    if (!miembro) return { success: false, error: "QR_NO_ENCONTRADO" };
    if (miembro.archivado) {
      return { success: false, error: "MIEMBRO_ARCHIVADO", nombre: miembro.nombre };
    }
    if (await congelacionActiva(tenant.id, miembro.id)) {
      return {
        success: false,
        error: "MEMBRESIA_CONGELADA",
        nombre: miembro.nombre,
      };
    }
    if (await visitasAgotadas(tenant.id, miembro.id)) {
      return { success: false, error: "SIN_VISITAS", nombre: miembro.nombre };
    }
    // Mismo QR sostenido frente al lector o doble tap: el lock del cliente se
    // libera a los 2.5s, esto cubre el hueco del lado del servidor.
    if (await checkinReciente(tenant.id, miembro.id)) {
      return { success: false, error: "CHECKIN_RECIENTE", nombre: miembro.nombre };
    }
    // sin_membresia sigue la misma política que vencido: no hay fecha =
    // nunca hubo vigencia que vencer, tampoco hay nada que "avisar y dejar
    // pasar".
    const vencidoOSinMembresia =
      !miembro.fecha_vencimiento || miembro.fecha_vencimiento < hoyISO();
    if (vencidoOSinMembresia && (await bloqueaVencidos(tenant.id))) {
      return { success: false, error: "MEMBRESIA_VENCIDA", nombre: miembro.nombre };
    }

    const res = await createCheckin(tenant.id, miembro.id);
    if (!res.ok) {
      return { success: false, error: "ERROR", nombre: miembro.nombre };
    }

    return {
      success: true,
      nombre: miembro.nombre,
      fechaVencimiento: miembro.fecha_vencimiento,
      avisoVencido: vencidoOSinMembresia,
      deudaVencida: await getDeudaVencida(tenant.id, miembro.id),
    };
  }
);
