/**
 * Utilidades de fecha ancladas a la zona horaria de México
 * (America/Mexico_City). El servidor corre en UTC; sin esto los límites de
 * día/mes se corren ~6h y afectan vencimientos, opiniones y cortes de caja.
 *
 * No usa librerías externas: `Intl.DateTimeFormat` es nativo en Node.
 * México ya no observa horario de verano (UTC-6 fijo), pero el cálculo del
 * offset es dinámico por si eso cambiara.
 */

const TZ = "America/Mexico_City";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const fmtLarga = new Intl.DateTimeFormat("es-MX", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const fmtCorta = new Intl.DateTimeFormat("es-MX", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

interface Wall {
  y: number;
  mo: number; // 1-12
  d: number;
  h: number;
  mi: number;
  s: number;
}

/** Componentes de reloj de pared en México para un instante dado. */
function wallMX(date: Date): Wall {
  const map: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    y: +map.year,
    mo: +map.month,
    d: +map.day,
    h: +map.hour % 24, // algunos motores devuelven "24" a medianoche
    mi: +map.minute,
    s: +map.second,
  };
}

/** Instante UTC que corresponde a un reloj de pared de México. */
function wallToInstant(
  y: number,
  mo: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
  ms = 0
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const w = wallMX(new Date(guess));
  const shown = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  const offset = shown - guess; // cuánto adelanta MX respecto a UTC
  return new Date(guess - offset);
}

/**
 * Normaliza una entrada a un instante. Una fecha de calendario ("YYYY-MM-DD",
 * sin hora) se ancla a mediodía de México para que al formatear en esa TZ no
 * se corra de día.
 */
function toInstant(date: Date | string): Date {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return wallToInstant(y, m, d, 12, 0, 0, 0);
  }
  return typeof date === "string" ? new Date(date) : date;
}

/**
 * "Ahora" con los getters LOCALES legibles como hora de México.
 * ⚠️ No llames `.toISOString()` sobre este valor (mostraría la hora de México
 * etiquetada como UTC). Para instantes usa hoyCDMX / inicioDeMesCDMX.
 */
export function nowMexico(): Date {
  const w = wallMX(new Date());
  return new Date(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
}

/** Instante de hoy a las 00:00:00 en México. */
export function hoyCDMX(): Date {
  const w = wallMX(new Date());
  return wallToInstant(w.y, w.mo, w.d, 0, 0, 0, 0);
}

/** Hoy como "YYYY-MM-DD" en México (para comparar/almacenar fechas sin hora). */
export function hoyISO(): string {
  const w = wallMX(new Date());
  return `${w.y}-${String(w.mo).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
}

/** Primer día del mes a las 00:00:00 en México. */
export function inicioDeMesCDMX(date: Date | string = new Date()): Date {
  const w = wallMX(toInstant(date));
  return wallToInstant(w.y, w.mo, 1, 0, 0, 0, 0);
}

/**
 * Fin del mes: el último instante del mes en México (1ms antes de que empiece
 * el siguiente). Evita el error de redondeo de milisegundos del offset.
 */
export function finDeMesCDMX(date: Date | string = new Date()): Date {
  const w = wallMX(toInstant(date));
  const y = w.mo === 12 ? w.y + 1 : w.y;
  const mo = w.mo === 12 ? 1 : w.mo + 1;
  return new Date(wallToInstant(y, mo, 1, 0, 0, 0, 0).getTime() - 1);
}

/** Fecha legible en español México: "29 de junio de 2026". */
export function formatearFechaMX(date: Date | string): string {
  return fmtLarga.format(toInstant(date));
}

/** Fecha corta México: "29/06/2026". */
export function fechaCorta(date: Date | string): string {
  return fmtCorta.format(toInstant(date));
}

/** ¿Ambas fechas caen en el mismo mes (año+mes) en la TZ de México? */
export function esMismoMesMX(
  date1: Date | string,
  date2: Date | string
): boolean {
  const a = wallMX(toInstant(date1));
  const b = wallMX(toInstant(date2));
  return a.y === b.y && a.mo === b.mo;
}
