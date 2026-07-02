import { DIAS_FRECUENCIA, type FrecuenciaCuota } from "@/lib/validations/creditos.schema";

/** Formatea un monto en pesos mexicanos con 2 decimales. */
export function money(n: number): string {
  return `$${n.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Reparte `total` en `n` cuotas exactas (centavos); el remanente va a la última. */
export function repartirMonto(total: number, n: number): number[] {
  if (n < 1) return [];
  const totalCent = Math.round(total * 100);
  const base = Math.floor(totalCent / n);
  const montos = Array.from({ length: n }, () => base);
  montos[n - 1] += totalCent - base * n;
  return montos.map((c) => c / 100);
}

/** Fecha (YYYY-MM-DD) a `dias` de hoy, en hora local. */
export function fechaISOaDias(dias: number, base: Date = new Date()): string {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fechas de vencimiento de N cuotas: la 1ª hoy, las siguientes por frecuencia. */
export function fechasCuotas(
  n: number,
  frecuencia: FrecuenciaCuota,
  base: Date = new Date()
): string[] {
  const interval = DIAS_FRECUENCIA[frecuencia];
  return Array.from({ length: n }, (_, i) => fechaISOaDias(i * interval, base));
}

/** Días entre hoy y una fecha ISO (negativo = ya venció). */
export function diasEntreHoyY(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha + "T00:00:00");
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}
