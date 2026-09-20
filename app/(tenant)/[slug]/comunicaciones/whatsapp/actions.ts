"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import {
  marcarConversacionLeida,
  toggleBot,
  enviarMensajeManual,
} from "@/lib/queries/inbox.queries";

// Inbox de WhatsApp: whatsapp_automatico (Escala) + usar_panel (cualquier
// staff: contestar es operación diaria). Ver lib/authz/politicas.ts.

export const marcarLeidaAction = panelAction(
  "inbox.marcar_leida",
  {},
  async (tenant, conversacionId: string): Promise<{ ok: boolean; error?: string }> => {
    await marcarConversacionLeida(tenant.id, conversacionId);
    revalidatePath(`/${tenant.slug}/comunicaciones/whatsapp`);
    return { ok: true };
  }
);

export const toggleBotAction = panelAction(
  "inbox.toggle_bot",
  {},
  async (
    tenant,
    conversacionId: string
  ): Promise<{ ok: boolean; bot_activo?: boolean; error?: string }> => {
    const bot_activo = await toggleBot(tenant.id, conversacionId);
    revalidatePath(`/${tenant.slug}/comunicaciones/whatsapp`);
    return { ok: true, bot_activo };
  }
);

export const enviarMensajeAction = panelAction(
  "inbox.enviar",
  {},
  async (tenant, conversacionId: string, texto: string): Promise<{ ok: boolean; error?: string }> => {
    const limpio = texto.trim();
    if (!limpio) return { ok: false, error: "El mensaje está vacío." };
    if (limpio.length > 1000) {
      return { ok: false, error: "El mensaje es demasiado largo (máx. 1000)." };
    }

    const r = await enviarMensajeManual(tenant.id, conversacionId, limpio);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/comunicaciones/whatsapp`);
    return { ok: true };
  }
);
