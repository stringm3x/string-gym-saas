import { DIAS_SEMANA } from "@/lib/types/clases";

/** Orden de la semana empezando en lunes (para mostrar). */
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** [1,3,5] → "Lun, Mié, Vie" (ordenado lunes→domingo). */
export function formatDiasSemana(dias: number[]): string {
  return ORDEN_SEMANA.filter((d) => dias.includes(d))
    .map((d) => DIAS_SEMANA[d])
    .join(", ");
}

/** "07:00" o "07:00:00" → "7:00 AM". */
export function formatHora12(hora: string): string {
  const [hStr, mStr] = hora.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}
