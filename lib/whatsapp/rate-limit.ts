/**
 * Rate limit en memoria para el bot de WhatsApp (Fase 7.5B).
 *
 * ⚠️ Best-effort en serverless: el Map vive por instancia (no se comparte entre
 * lambdas ni sobrevive cold starts). Suficiente para los primeros gyms; cuando
 * el volumen crezca, migrar a un store compartido (KV/Redis).
 */

const MAX_POR_VENTANA = 10;
const VENTANA_MS = 60 * 60 * 1000; // 1 hora

const registros = new Map<string, number[]>();

/**
 * Registra un mensaje del número y devuelve true si está DENTRO del límite
 * (10 por hora). Limpia timestamps viejos en cada llamada.
 */
export function dentroDeLimite(telefono: string): boolean {
  const ahora = Date.now();
  const desde = ahora - VENTANA_MS;
  const previos = (registros.get(telefono) ?? []).filter((t) => t > desde);

  if (previos.length >= MAX_POR_VENTANA) {
    registros.set(telefono, previos);
    return false;
  }

  previos.push(ahora);
  registros.set(telefono, previos);

  // Poda ocasional de números inactivos para no crecer sin límite.
  if (registros.size > 5000) {
    for (const [num, ts] of registros) {
      if (ts.every((t) => t <= desde)) registros.delete(num);
    }
  }

  return true;
}
