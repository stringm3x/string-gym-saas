import { Resend } from "resend";

const FROM = "STRING GYM <noreply@stringwebs.com>";

/** Envía el código de acceso al portal por email. Devuelve true si se envió. */
export async function sendCodigoPortal(params: {
  email: string;
  nombre: string;
  codigo: string;
  gymNombre: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.email,
      subject: `Tu código de acceso — ${params.gymNombre}`,
      html: `
        <h2>Hola ${escapeHtml(params.nombre)}</h2>
        <p>Tu código para entrar al portal de
        <b>${escapeHtml(params.gymNombre)}</b> es:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${params.codigo}</p>
        <p>Vence en 10 minutos. Si no lo solicitaste, ignora este correo.</p>`,
    });
    return !error;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[<>&]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string
  );
}
