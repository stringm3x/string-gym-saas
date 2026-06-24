import type { Clase, SesionToCreate } from "@/lib/types/clases";

/** "YYYY-MM-DD" → Date en UTC (medianoche), sin desfase por zona horaria. */
function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** hora_inicio ("HH:MM[:SS]") + duración → "HH:MM:SS" (clamp al fin del día). */
export function calcularHoraFin(horaInicio: string, duracionMin: number): string {
  const [h, m] = horaInicio.split(":").map(Number);
  let total = h * 60 + m + duracionMin;
  if (total > 1439) total = 1439; // un valor `time` no puede pasar de 23:59
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/**
 * Genera las sesiones (instancias) de una clase.
 *
 * - Recurrente: una sesión por cada día (en `dias_semana`) entre hoy y
 *   hoy + semanasAGenerar×7, respetando `fecha_inicio` y `fecha_fin`.
 * - No recurrente: una sola sesión en `fecha_inicio`.
 *
 * Función pura: `desde` se inyecta para tests deterministas.
 * Convención de días: 0=domingo … 6=sábado (igual que getUTCDay()).
 */
export function generarSesionesPara(
  clase: Clase,
  semanasAGenerar = 4,
  desde: Date = new Date()
): SesionToCreate[] {
  const base = {
    clase_id: clase.id,
    hora_inicio: clase.hora_inicio,
    hora_fin: calcularHoraFin(clase.hora_inicio, clase.duracion_minutos),
    cupo_maximo: clase.cupo_maximo,
    cupo_disponible: clase.cupo_maximo,
  };

  if (!clase.es_recurrente) {
    return [{ ...base, fecha: clase.fecha_inicio }];
  }

  const out: SesionToCreate[] = [];
  const start = startOfUTCDay(desde);
  const end = addDays(start, semanasAGenerar * 7);
  const fechaInicio = parseYMD(clase.fecha_inicio);
  const fechaFin = clase.fecha_fin ? parseYMD(clase.fecha_fin) : null;

  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (d < fechaInicio) continue;
    if (fechaFin && d > fechaFin) break;
    if (!clase.dias_semana.includes(d.getUTCDay())) continue;
    out.push({ ...base, fecha: toYMD(d) });
  }
  return out;
}
