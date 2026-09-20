/**
 * Logger mínimo: una línea JSON por evento, greppable en Vercel por `tag`.
 * No es una librería (sin Pino/Winston, sin transporte propio) — Vercel ya
 * captura stdout/stderr de cada request y los indexa; lo único que faltaba
 * era una forma consistente de escribirlos. Formaliza el patrón que ya
 * existía suelto en lib/authz/index.ts (`console.warn(JSON.stringify({tag,...}))`).
 *
 * Uso: logError("recibo.envio_fallido", { tenantId, pagoId, error: r.error }).
 * En Vercel: buscar `"tag":"recibo.envio_fallido"`.
 */

type Nivel = "error" | "warn" | "info";

function escribir(nivel: Nivel, tag: string, detalle: Record<string, unknown>): void {
  const linea = JSON.stringify({ nivel, tag, ...detalle, ts: new Date().toISOString() });
  if (nivel === "error") console.error(linea);
  else if (nivel === "warn") console.warn(linea);
  else console.info(linea);
}

/** Algo falló de forma que alguien debe revisar (escritura perdida, envío roto). */
export function logError(tag: string, detalle: Record<string, unknown> = {}): void {
  escribir("error", tag, detalle);
}

/** Algo no salió como se esperaba pero no es necesariamente un bug (0 filas, reintento). */
export function logWarn(tag: string, detalle: Record<string, unknown> = {}): void {
  escribir("warn", tag, detalle);
}
