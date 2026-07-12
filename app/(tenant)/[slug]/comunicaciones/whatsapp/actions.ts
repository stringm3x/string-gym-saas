"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import {
  marcarConversacionLeida,
  toggleBot,
  enviarMensajeManual,
} from "@/lib/queries/inbox.queries";

const FEATURE = "whatsapp_automatico" as const;

/** Gate compartido: el plan debe incluir WhatsApp automático. */
async function guard() {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, FEATURE)) {
    return { tenant, ok: false as const, error: "Tu plan no incluye WhatsApp." };
  }
  return { tenant, ok: true as const };
}

export async function marcarLeidaAction(
  conversacionId: string
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  await marcarConversacionLeida(g.tenant.id, conversacionId);
  revalidatePath(`/${g.tenant.slug}/comunicaciones/whatsapp`);
  return { ok: true };
}

export async function toggleBotAction(
  conversacionId: string
): Promise<{ ok: boolean; bot_activo?: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const bot_activo = await toggleBot(g.tenant.id, conversacionId);
  revalidatePath(`/${g.tenant.slug}/comunicaciones/whatsapp`);
  return { ok: true, bot_activo };
}

export async function enviarMensajeAction(
  conversacionId: string,
  texto: string
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const limpio = texto.trim();
  if (!limpio) return { ok: false, error: "El mensaje está vacío." };
  if (limpio.length > 1000) {
    return { ok: false, error: "El mensaje es demasiado largo (máx. 1000)." };
  }

  const r = await enviarMensajeManual(g.tenant.id, conversacionId, limpio);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${g.tenant.slug}/comunicaciones/whatsapp`);
  return { ok: true };
}
