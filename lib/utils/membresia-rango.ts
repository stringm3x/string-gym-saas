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

/**
 * Calcula el rango (inicio, fin) de un periodo de membresía a partir de:
 * - hoy
 * - la fecha de vencimiento actual del miembro (si la tiene Y no está vencida)
 *
 * Regla: si paga antes de vencer, EXTIENDE desde la fecha de vencimiento.
 * Si ya venció o no tiene fecha, EMPIEZA desde hoy.
 *
 * Esto evita "perder días" cuando el cliente paga con anticipación.
 */
export function calcularRangoMembresia(
  preset: DuracionPreset,
  fechaVencimientoActual: string | null | undefined,
  hoy: Date = new Date()
): { periodo_inicio: string; periodo_fin: string } {
  const dias = duracionPresets[preset].dias;

  const inicioHoy = new Date(hoy);
  inicioHoy.setHours(0, 0, 0, 0);

  let inicio = inicioHoy;
  if (fechaVencimientoActual) {
    const vencActual = new Date(fechaVencimientoActual + "T00:00:00");
    if (vencActual > inicioHoy) {
      // Aún vigente — extender desde el día siguiente al vencimiento actual.
      inicio = new Date(vencActual);
      inicio.setDate(inicio.getDate() + 1);
    }
  }

  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + dias - 1);

  return {
    periodo_inicio: toISODate(inicio),
    periodo_fin: toISODate(fin),
  };
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
