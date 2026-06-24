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

// ───────────────────── Helpers de semana (YYYY-MM-DD, UTC) ─────────────────────

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana que contiene a `fechaYMD`. */
export function inicioSemana(fechaYMD: string): string {
  const d = parseYMD(fechaYMD);
  const dow = d.getUTCDay(); // 0=domingo … 6=sábado
  const diff = dow === 0 ? -6 : 1 - dow;
  return toYMD(new Date(d.getTime() + diff * 86_400_000));
}

/** Suma `n` días a una fecha YYYY-MM-DD. */
export function sumarDiasYMD(fechaYMD: string, n: number): string {
  return toYMD(new Date(parseYMD(fechaYMD).getTime() + n * 86_400_000));
}

/** Los 7 días (lunes→domingo) a partir del lunes dado. */
export function diasDeSemana(lunesYMD: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDiasYMD(lunesYMD, i));
}

/** "2026-06-22" → "Lun 22 jun". */
export function formatDiaCorto(fechaYMD: string): string {
  const d = parseYMD(fechaYMD);
  const dia = DIAS_SEMANA[d.getUTCDay()];
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${dia} ${d.getUTCDate()} ${meses[d.getUTCMonth()]}`;
}

/** Hoy en formato YYYY-MM-DD (zona local). */
export function hoyYMD(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
