/**
 * Normaliza un teléfono mexicano al formato que espera wa.me/360dialog:
 * lada 52 + 10 dígitos, sin '+' ni separadores.
 *
 * La app solo guarda 10 dígitos (miembro.schema.ts exige exactamente 10),
 * pero wa.me y la API de WhatsApp Business necesitan el número completo o
 * responden "número inválido" / rechazan el envío. Acepta:
 * - 10 dígitos limpios, o con espacios/guiones/paréntesis → antepone 52.
 * - Ya con lada 52 (12 dígitos, típicamente de "+52 55...") → se deja igual,
 *   no se duplica.
 * - La convención vieja "521" + 10 dígitos (13 dígitos, algunos miembros la
 *   traen capturada a mano) → se le quita el "1" redundante, que es el
 *   formato que Meta dejó de requerir.
 * - Cualquier otro largo (número mal capturado, de otro país) → se deja tal
 *   cual, sin inventar una lada sobre un número que no se reconoce.
 */
export function normalizarTelefonoMx(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 10) return `52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith("52")) return digitos;
  if (digitos.length === 13 && digitos.startsWith("521")) {
    return `52${digitos.slice(3)}`;
  }
  return digitos;
}

/** Construye una URL wa.me con mensaje, normalizando el teléfono a E.164 MX. */
export function buildWhatsAppUrl(telefono: string, mensaje: string): string {
  const numero = normalizarTelefonoMx(telefono);
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/** Mensaje pre-redactado de confirmación de pago para el miembro. */
export function mensajePagoRegistrado(
  nombre: string,
  montoStr: string,
  fechaVencimientoStr: string | null
): string {
  const venc = fechaVencimientoStr
    ? ` Tu próxima fecha de vencimiento es ${fechaVencimientoStr}.`
    : "";
  return `¡Hola ${nombre}! Tu pago de ${montoStr} fue registrado correctamente.${venc} ¡Gracias!`;
}
