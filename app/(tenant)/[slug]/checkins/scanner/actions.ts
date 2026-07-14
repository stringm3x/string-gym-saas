"use server";

import { getTenant } from "@/lib/tenant";
import { getMiembroByQrToken } from "@/lib/queries/qr.queries";
import { createCheckin } from "@/lib/queries/checkins.queries";
import { hoyISO } from "@/lib/utils/dates";

export type CheckInQrError =
  | "QR_NO_ENCONTRADO"
  | "MIEMBRO_ARCHIVADO"
  | "MEMBRESIA_VENCIDA"
  | "ERROR";

export type CheckInQrResult =
  | { success: true; nombre: string; fechaVencimiento: string | null }
  | { success: false; error: CheckInQrError; nombre?: string };

/**
 * Check-in por token de QR. Lo usan owner y recepcionista (operación diaria),
 * por eso no lleva feature gate aquí (el gate está en la página). El lookup es
 * acotado por tenant → un token de otro gym no se encuentra (tenant isolation).
 */
export async function checkInPorQrAction(
  token: string
): Promise<CheckInQrResult> {
  const tenant = await getTenant();
  const t = (token || "").trim();
  if (!t) return { success: false, error: "QR_NO_ENCONTRADO" };

  const miembro = await getMiembroByQrToken(tenant.id, t);
  if (!miembro) return { success: false, error: "QR_NO_ENCONTRADO" };
  if (miembro.archivado) {
    return { success: false, error: "MIEMBRO_ARCHIVADO", nombre: miembro.nombre };
  }
  if (miembro.fecha_vencimiento && miembro.fecha_vencimiento < hoyISO()) {
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
  };
}
