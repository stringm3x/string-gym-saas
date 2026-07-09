import { hoyISO } from "./dates";

/**
 * Duraciones predefinidas para membresía.
 * Días aproximados — usados para mostrar opciones rápidas en el form.
 */
export type DuracionPreset =
  | "1_semana"
  | "15_dias"
  | "1_mes"
  | "3_meses"
  | "6_meses"
  | "anual";

export const duracionPresets: Record<
  DuracionPreset,
  { label: string; dias: number }
> = {
  "1_semana": { label: "1 semana", dias: 7 },
  "15_dias": { label: "15 días", dias: 15 },
  "1_mes": { label: "1 mes", dias: 30 },
  "3_meses": { label: "3 meses", dias: 90 },
  "6_meses": { label: "6 meses", dias: 180 },
  anual: { label: "1 año", dias: 365 },
};

/** Tipo de operación de membresía según el estado del miembro. */
export type TipoOperacionMembresia = "nuevo" | "renovacion" | "reactivacion";

/**
 * Umbral (en días vencido) para distinguir renovación tardía de reactivación.
 * - Vencido <= 30 días → renovación tardía (ancla a la fecha original).
 * - Vencido > 30 días → reactivación (resetea a HOY).
 */
export const DIAS_REACTIVACION = 30;

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, dias: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + dias);
  return c;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Determina el tipo de operación a partir de la fecha de vencimiento actual.
 * - Sin vencimiento → nuevo.
 * - Vigente (vence hoy o después) → renovación.
 * - Vencido <= DIAS_REACTIVACION días → renovación (tardía).
 * - Vencido > DIAS_REACTIVACION días → reactivación.
 */
export function tipoOperacionMembresia(
  fechaVencimientoActual: string | null | undefined,
  hoy: Date = new Date(hoyISO() + "T00:00:00")
): TipoOperacionMembresia {
  if (!fechaVencimientoActual) return "nuevo";

  const inicioHoy = startOfDay(hoy);
  const venc = new Date(fechaVencimientoActual + "T00:00:00");

  if (venc >= inicioHoy) return "renovacion";

  const diasVencido = Math.floor(
    (inicioHoy.getTime() - venc.getTime()) / 86_400_000
  );
  return diasVencido <= DIAS_REACTIVACION ? "renovacion" : "reactivacion";
}

/**
 * Calcula el rango (inicio, fin) de un periodo de membresía según D1:
 *
 * - **Renovación** (vigente o vencido <= 30 días): suma la duración a la
 *   `fecha_vencimiento` original. El nuevo periodo es contiguo
 *   (inicio = venc + 1 día, fin = venc + dias). Respeta el día de pago y no
 *   regala días por pagar tarde dentro del umbral.
 * - **Reactivación** (vencido > 30 días) y **nuevo**: empieza HOY
 *   (inicio = hoy, fin = hoy + dias - 1).
 */
export function calcularRangoPorDias(
  dias: number,
  fechaVencimientoActual: string | null | undefined,
  hoy: Date = new Date(hoyISO() + "T00:00:00")
): {
  periodo_inicio: string;
  periodo_fin: string;
  tipo: TipoOperacionMembresia;
} {
  const tipo = tipoOperacionMembresia(fechaVencimientoActual, hoy);

  if (tipo === "renovacion" && fechaVencimientoActual) {
    const venc = new Date(fechaVencimientoActual + "T00:00:00");
    return {
      periodo_inicio: toISODate(addDays(venc, 1)),
      periodo_fin: toISODate(addDays(venc, dias)),
      tipo,
    };
  }

  // nuevo / reactivación → desde hoy
  const inicioHoy = startOfDay(hoy);
  return {
    periodo_inicio: toISODate(inicioHoy),
    periodo_fin: toISODate(addDays(inicioHoy, dias - 1)),
    tipo,
  };
}

/**
 * Variante por preset (azúcar sobre calcularRangoPorDias). Mantiene la firma
 * histórica `{ periodo_inicio, periodo_fin }` usada por el formulario de caja.
 */
export function calcularRangoMembresia(
  preset: DuracionPreset,
  fechaVencimientoActual: string | null | undefined,
  hoy: Date = new Date(hoyISO() + "T00:00:00")
): { periodo_inicio: string; periodo_fin: string } {
  const { periodo_inicio, periodo_fin } = calcularRangoPorDias(
    duracionPresets[preset].dias,
    fechaVencimientoActual,
    hoy
  );
  return { periodo_inicio, periodo_fin };
}
