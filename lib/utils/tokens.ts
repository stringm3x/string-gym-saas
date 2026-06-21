/**
 * Genera un token público para acceder a un recibo sin login.
 * Usa crypto.randomUUID (sin dependencias extra), sin guiones para una URL
 * más limpia.
 */
export function generarTokenRecibo(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
