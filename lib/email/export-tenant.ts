import { Resend } from "resend";

const FROM = "STRING GYM <noreply@stringwebs.com>";

function esc(s: string): string {
  return String(s ?? "").replace(/[<>&]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string
  );
}

/**
 * Envía al owner el ZIP con sus datos exportados. Devuelve true si se envió.
 * No lanza: si falla (o no hay API key), devuelve false para que el caller
 * deje `exportar_datos_pendiente = true` y se pueda reintentar.
 */
export async function sendDatosExportados(params: {
  email: string;
  nombreGym: string;
  slug: string;
  zip: Buffer;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.email,
      subject: `Tus datos de STRING GYM — ${params.nombreGym}`,
      html: `
        <h2>Tus datos de STRING GYM</h2>
        <p>Hola,</p>
        <p>Adjunto encontrarás todos tus datos exportados de
        <b>${esc(params.nombreGym)}</b>: miembros, pagos y check-ins en
        formato CSV, comprimidos en un archivo ZIP.</p>
        <p>Gracias por haber usado STRING GYM.</p>
        <p>— El equipo de STRING GYM</p>`,
      attachments: [
        {
          filename: `datos-${params.slug}.zip`,
          content: params.zip,
        },
      ],
    });
    if (error) {
      console.error("[export-tenant] Resend error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[export-tenant] error inesperado:", e);
    return false;
  }
}
