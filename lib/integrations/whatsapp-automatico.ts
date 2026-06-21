/**
 * Capa 3 — WhatsApp automático del recibo (Fase 7.5).
 *
 * DORMIDO por diseño: hoy NO hay infraestructura (n8n + 360dialog). Esta
 * función solo actúa si `N8N_WHATSAPP_WEBHOOK_URL` está configurado; mientras
 * no lo esté es un no-op total (no cambia el comportamiento actual del cobro).
 *
 * En Fase 7.5 se construye el flujo de n8n con plantilla aprobada por Meta y
 * se configura la env var; este disparo se activa automáticamente SIN cambios
 * de código. Nunca lanza: no debe bloquear ni afectar el registro del pago.
 */
export interface WhatsAppAutomaticoPayload {
  gymId: string;
  miembroNombre: string;
  telefono: string | null;
  monto: number;
  fechaVencimiento: string | null;
  reciboUrl: string;
}

export async function dispararWhatsAppAutomatico(
  payload: WhatsAppAutomaticoPayload
): Promise<void> {
  const webhook = process.env.N8N_WHATSAPP_WEBHOOK_URL;
  // No-op hoy: sin webhook configurado o sin teléfono no se hace nada.
  if (!webhook || !payload.telefono) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silencioso: la Capa 3 nunca afecta el flujo del pago.
  }
}
