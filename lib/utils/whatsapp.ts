/** Construye una URL wa.me con mensaje, limpiando el teléfono a solo dígitos. */
export function buildWhatsAppUrl(telefono: string, mensaje: string): string {
  const numero = telefono.replace(/\D/g, "");
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
