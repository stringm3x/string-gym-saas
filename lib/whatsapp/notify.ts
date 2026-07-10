/**
 * Motor de notificaciones WhatsApp (Fase 7.5).
 *
 * DORMIDO por diseño: `notifyWhatsapp` hace un POST fire-and-forget al webhook
 * de n8n (`N8N_WEBHOOK_URL`), que enruta al template de 360dialog. Si la env var
 * no está configurada, es un NO-OP silencioso — no cambia ningún flujo actual.
 *
 * Nunca lanza: una notificación jamás debe romper un cobro, una inscripción,
 * ni el cron. La infra (VPS + n8n + 360dialog) se conecta cuando llega el
 * primer cliente Escala; este código se activa solo al poner la env var.
 */

interface GymBase {
  gymId: string;
  gymSlug: string;
  gymNombre: string;
}

/** Gym con credenciales de su subcuenta 360dialog (eventos al miembro). */
interface GymWa extends GymBase {
  whatsappNumero: string | null;
  whatsappApiKey: string | null;
}

/** Destinatario miembro. */
interface MiembroDest {
  miembroNombre: string;
  miembroTelefono: string | null;
}

export type WhatsappEvent =
  | (GymWa &
      MiembroDest & {
        tipo: "MEMBRESIA_POR_VENCER";
        diasRestantes: number;
        fechaVencimiento: string;
      })
  | (GymWa &
      MiembroDest & {
        tipo: "MEMBRESIA_VENCIDA";
        fechaVencimiento: string;
      })
  | (GymWa &
      MiembroDest & {
        tipo: "PAGO_REGISTRADO";
        monto: number;
        planNombre: string;
        fechaVencimiento: string | null;
        reciboUrl?: string;
      })
  | (GymBase & {
      tipo: "PROSPECTO_NUEVO";
      ownerTelefono: string | null;
      prospectoNombre: string;
      prospectoTelefono: string | null;
      planInteres: string | null;
      origen: string;
    })
  | (GymWa &
      MiembroDest & {
        tipo: "MIEMBRO_SIN_ACTIVIDAD";
        diasSinVenir: number;
      })
  | (GymWa &
      MiembroDest & {
        tipo: "BIENVENIDA_MIEMBRO";
        planNombre: string;
        fechaVencimiento: string;
      })
  | (GymBase & {
      tipo: "RESUMEN_DIARIO";
      ownerTelefono: string | null;
      checkinshoy: number;
      ingresosHoy: number;
      vencimientosEstaSemana: number;
      prospectosPendientes: number;
    });

/** Teléfono destino del evento (miembro o owner según el tipo). */
function destinoDe(event: WhatsappEvent): string | null {
  switch (event.tipo) {
    case "PROSPECTO_NUEVO":
    case "RESUMEN_DIARIO":
      return event.ownerTelefono;
    default:
      return event.miembroTelefono;
  }
}

/**
 * Dispara una notificación de WhatsApp. Fire-and-forget: nunca lanza; si el
 * webhook no está configurado o no hay teléfono destino, es no-op silencioso.
 */
export async function notifyWhatsapp(event: WhatsappEvent): Promise<void> {
  const webhook = process.env.N8N_WEBHOOK_URL;
  if (!webhook) return; // infra dormida → no-op
  if (!destinoDe(event)) return; // sin destinatario → nada que enviar

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (err) {
    // Nunca bloquea el flujo de negocio; solo se registra.
    console.error(`[whatsapp] notify falló (${event.tipo}):`, err);
  }
}
