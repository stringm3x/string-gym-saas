"use server";

import { hasFeature } from "@/lib/features";
import {
  getPortalGym,
  findMiembroByIdentificador,
  crearVerificacion,
  verificarCodigo,
  crearSession,
} from "@/lib/queries/portal.queries";
import { sendCodigoPortal } from "@/lib/email/portal";
import { emitOtpWhatsapp } from "@/lib/whatsapp/emit";
import { setPortalCookie } from "@/lib/portal/session";

function maskEmail(email: string): string {
  const [user, dom] = email.split("@");
  if (!dom) return email;
  const visible = user.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(1, user.length - 1))}@${dom}`;
}

function maskTel(tel: string): string {
  const d = tel.replace(/\D/g, "");
  return d.length >= 4 ? `••••${d.slice(-4)}` : tel;
}

async function resolver(slug: string, identificador: string) {
  const gym = await getPortalGym(slug);
  if (!gym) return { error: "Gimnasio no encontrado." as const };
  if (!hasFeature(gym.plan, "portal_miembro")) {
    return { error: "El portal no está disponible para este gimnasio." as const };
  }
  if (!identificador.trim()) {
    return { error: "Escribe tu teléfono o correo." as const };
  }
  const miembro = await findMiembroByIdentificador(gym.id, identificador);
  if (!miembro) {
    return {
      error:
        "No encontramos tu cuenta. Verifica el dato o pídele a tu gym que te registre." as const,
    };
  }
  return { gym, miembro };
}

export async function solicitarCodigoAction(
  slug: string,
  identificador: string,
  canal: "email" | "whatsapp" = "email"
): Promise<{ ok: boolean; error?: string; destinoMask?: string }> {
  const r = await resolver(slug, identificador);
  if ("error" in r) return { ok: false, error: r.error };
  const { gym, miembro } = r;

  if (canal === "whatsapp") {
    if (!miembro.telefono) {
      return {
        ok: false,
        error: "No tienes un teléfono registrado. Pídele a tu gym que lo agregue.",
      };
    }
    const gen = await crearVerificacion(gym.id, miembro.id, "whatsapp");
    if (!gen.ok) return { ok: false, error: gen.error };

    const enviado = await emitOtpWhatsapp(gym.id, miembro.telefono, gen.codigo);
    if (!enviado) {
      return {
        ok: false,
        error: "WhatsApp no está disponible ahora. Usa tu correo.",
      };
    }
    return { ok: true, destinoMask: maskTel(miembro.telefono) };
  }

  if (!miembro.email) {
    return {
      ok: false,
      error:
        "No tienes un correo registrado. Pídele a tu gym que lo agregue para poder entrar.",
    };
  }

  const gen = await crearVerificacion(gym.id, miembro.id, "email");
  if (!gen.ok) return { ok: false, error: gen.error };

  const enviado = await sendCodigoPortal({
    email: miembro.email,
    nombre: miembro.nombre,
    codigo: gen.codigo,
    gymNombre: gym.nombre,
  });
  if (!enviado) {
    return { ok: false, error: "No se pudo enviar el código. Intenta de nuevo." };
  }

  return { ok: true, destinoMask: maskEmail(miembro.email) };
}

export async function verificarCodigoAction(
  slug: string,
  identificador: string,
  codigo: string
): Promise<{ ok: boolean; error?: string }> {
  const r = await resolver(slug, identificador);
  if ("error" in r) return { ok: false, error: r.error };
  const { gym, miembro } = r;

  const v = await verificarCodigo(gym.id, miembro.id, codigo);
  if (!v.ok) return { ok: false, error: v.error };

  const s = await crearSession(gym.id, miembro.id);
  if (!s.ok) return { ok: false, error: s.error };

  await setPortalCookie(s.token);
  return { ok: true };
}
