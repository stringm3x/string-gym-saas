/**
 * Estado derivado de la membresía a partir de fecha_vencimiento.
 * Se calcula en runtime (no se persiste) — la columna `estado` en la
 * tabla queda como override manual opcional, pero el dashboard y la
 * UI muestran SIEMPRE el estado calculado para tener una sola fuente
 * de verdad: la fecha.
 */
import { hoyISO } from "./dates";

export type EstadoMembresia =
  | "activo"
  | "por_vencer"
  | "vencido"
  | "sin_membresia";

const DIAS_AVISO_POR_VENCER = 7;

const MS_POR_DIA = 1000 * 60 * 60 * 24;

/**
 * Devuelve el estado calculado a partir de la fecha de vencimiento.
 * - sin_membresia: no hay fecha de vencimiento registrada
 * - vencido: fecha pasada
 * - por_vencer: dentro de los próximos 7 días
 * - activo: más de 7 días en el futuro
 */
const VISITAS_AVISO = 2; // "por vencer" cuando quedan estas o menos

export function getEstadoMembresia(
  fechaVencimiento: string | null | undefined,
  hoy: Date = new Date(hoyISO() + "T00:00:00"),
  visitasRestantes?: number | null
): EstadoMembresia {
  // Plan por visitas (D3): la vigencia la manda el saldo de visitas.
  if (visitasRestantes !== null && visitasRestantes !== undefined) {
    if (visitasRestantes <= 0) return "vencido";
    if (visitasRestantes <= VISITAS_AVISO) return "por_vencer";
    return "activo";
  }

  if (!fechaVencimiento) {
    return "sin_membresia";
  }

  // Comparar en días, ignorando hora (evita falsos "vencido" por horario).
  const vencimiento = new Date(fechaVencimiento + "T00:00:00");
  const inicioHoy = new Date(hoy);
  inicioHoy.setHours(0, 0, 0, 0);

  const diffDias = Math.floor(
    (vencimiento.getTime() - inicioHoy.getTime()) / MS_POR_DIA
  );

  if (diffDias < 0) return "vencido";
  if (diffDias <= DIAS_AVISO_POR_VENCER) return "por_vencer";
  return "activo";
}

/**
 * Días restantes hasta el vencimiento (negativo si ya venció).
 */
export function diasParaVencer(
  fechaVencimiento: string | null | undefined,
  hoy: Date = new Date(hoyISO() + "T00:00:00")
): number | null {
  if (!fechaVencimiento) return null;

  const vencimiento = new Date(fechaVencimiento + "T00:00:00");
  const inicioHoy = new Date(hoy);
  inicioHoy.setHours(0, 0, 0, 0);

  return Math.floor((vencimiento.getTime() - inicioHoy.getTime()) / MS_POR_DIA);
}
