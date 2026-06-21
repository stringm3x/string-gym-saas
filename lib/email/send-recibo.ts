import { Resend } from "resend";
import { formatFecha, formatMoneda } from "@/lib/utils/format";
import { reciboEmailHtml } from "./templates/recibo";

export interface SendReciboParams {
  miembroEmail: string;
  miembroNombre: string;
  gymNombre: string;
  gymTelefono?: string | null;
  gymDireccion?: string | null;
  logoUrl?: string | null;
  /** Color de acento (solo Pro+; el caller decide si lo pasa). */
  colorAcento?: string;
  monto: number;
  fechaVencimiento?: string | null;
  reciboUrl: string;
}

const FROM_EMAIL = "noreply@stringwebs.com";

/**
 * Envía el recibo por email vía Resend. No lanza: ante cualquier fallo
 * devuelve { ok:false } para que el caller NO bloquee el pago.
 */
export async function sendRecibo(
  params: SendReciboParams
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }

  const montoStr = formatMoneda(params.monto);
  const safeName = params.gymNombre.replace(/[",<>\r\n]/g, "").trim() || "STRING GYM";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${safeName} <${FROM_EMAIL}>`,
      to: params.miembroEmail,
      subject: `Tu recibo del ${safeName} - ${montoStr} MXN`,
      html: reciboEmailHtml({
        miembroNombre: params.miembroNombre,
        gymNombre: params.gymNombre,
        gymTelefono: params.gymTelefono,
        gymDireccion: params.gymDireccion,
        logoUrl: params.logoUrl,
        colorAcento: params.colorAcento,
        montoStr,
        fechaVencimientoStr: params.fechaVencimiento
          ? formatFecha(params.fechaVencimiento)
          : null,
        reciboUrl: params.reciboUrl,
      }),
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de envío" };
  }
}
