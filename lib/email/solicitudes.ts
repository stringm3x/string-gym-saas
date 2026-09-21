import { Resend } from "resend";
import { STRING_SOPORTE_WHATSAPP } from "@/lib/constants";

const FROM = "STRING GYM <noreply@stringwebs.com>";
const ALERTA_TO = "hola@stringwebs.com";
const DEMO_URL = "https://app.gym.stringwebs.com/gym-demo/hoy";

function resend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[<>&]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string
  );
}

interface SolicitudData {
  nombre: string;
  email: string;
  telefono?: string | null;
  nombre_gym?: string | null;
  plan_interes?: string | null;
  ciudad?: string | null;
  miembros_aprox?: number | null;
  como_entero?: string | null;
  notas?: string | null;
}

/** Aviso interno a STRING de una nueva solicitud. No lanza. */
export async function sendAlertaSolicitud(s: SolicitudData): Promise<void> {
  const r = resend();
  if (!r) return;
  const filas = [
    ["Gym", s.nombre_gym],
    ["Contacto", s.nombre],
    ["Email", s.email],
    ["Teléfono", s.telefono],
    ["Plan", s.plan_interes],
    ["Ciudad", s.ciudad],
    ["Miembros aprox.", s.miembros_aprox != null ? String(s.miembros_aprox) : null],
    ["Cómo se enteró", s.como_entero],
    ["Notas", s.notas],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><b>${esc(String(v))}</b></td></tr>`)
    .join("");
  try {
    await r.emails.send({
      from: FROM,
      to: ALERTA_TO,
      subject: `Nueva solicitud: ${s.nombre_gym ?? s.nombre} (${s.plan_interes ?? "?"})`,
      html: `<h2>Nueva solicitud de prueba</h2><table>${filas}</table>`,
    });
  } catch {
    /* no bloquear */
  }
}

/** Email de bienvenida al prospecto tras registrarse. No lanza. */
export async function sendBienvenidaSolicitud(s: SolicitudData): Promise<void> {
  const r = resend();
  if (!r) return;
  const wa = `https://wa.me/${STRING_SOPORTE_WHATSAPP}`;
  try {
    await r.emails.send({
      from: FROM,
      to: s.email,
      subject: "¡Gracias por tu interés en STRING GYM!",
      html: `
        <h2>¡Hola ${esc(s.nombre)}!</h2>
        <p>Gracias por tu interés en <b>STRING GYM</b>. Recibimos tu solicitud
        y te contactaremos en menos de 24 horas.</p>
        <p>Mientras tanto, explora una demo en vivo:</p>
        <p><a href="${DEMO_URL}">Ver demo de STRING GYM</a></p>
        <p>¿Dudas? Escríbenos por WhatsApp: <a href="${wa}">+52 55 4552 4847</a></p>
        <p>— El equipo de STRING GYM</p>`,
    });
  } catch {
    /* no bloquear */
  }
}

/**
 * Email de invitación al owner cuando se activa su gym: nunca existe una
 * contraseña temporal, el dueño la crea él mismo al abrir `inviteLink`
 * (Bloque 10 PR2 — mismo mecanismo que las invitaciones de staff). No
 * lanza. Devuelve true si Resend confirmó el envío, false si no hay API key
 * configurada o el envío falló — el caller (admin) necesita saberlo para
 * poder compartir el enlace manualmente si el email no salió.
 */
export async function sendInvitacionOwner(params: {
  email: string;
  nombreGym: string;
  slug: string;
  inviteLink: string;
}): Promise<boolean> {
  const r = resend();
  if (!r) return false;
  try {
    const { error } = await r.emails.send({
      from: FROM,
      to: params.email,
      subject: `Tu cuenta de STRING GYM está lista — ${params.nombreGym}`,
      html: `
        <h2>¡Bienvenido a STRING GYM!</h2>
        <p>Tu gimnasio <b>${esc(params.nombreGym)}</b> ya está activo.</p>
        <p><a href="${esc(params.inviteLink)}"><b>Crea tu contraseña y entra a tu panel</b></a></p>
        <p>Este enlace es de un solo uso. Si ya venció, pide que te lo
        reenvíen desde STRING.</p>
        <p>— El equipo de STRING GYM</p>`,
    });
    return !error;
  } catch {
    return false;
  }
}
