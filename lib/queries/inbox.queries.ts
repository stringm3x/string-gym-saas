/**
 * Queries del inbox de WhatsApp (Fase 7.5C, Bloque 2). El dueño lee y responde
 * conversaciones desde STRING GYM. Las lecturas usan el client de sesión (RLS
 * por user_gym_ids); el envío saliente pasa por sendWhatsappText + registrarMensaje
 * (service-role) para reflejarse en el historial.
 */
import { createClient } from "@/lib/supabase/server";
import { sendWhatsappText } from "@/lib/whatsapp/360dialog";
import { registrarMensaje } from "@/lib/whatsapp/registro";

export interface ConversacionResumen {
  id: string;
  telefono: string;
  nombre_contacto: string | null;
  miembro_id: string | null;
  miembro_nombre: string | null;
  ultimo_mensaje_at: string | null;
  no_leidos: number;
  bot_activo: boolean;
  /** Preview: contenido del último mensaje de la conversación. */
  ultimo_mensaje: string | null;
}

export interface MensajeInbox {
  id: string;
  direccion: "entrante" | "saliente";
  tipo: "texto" | "template" | "bot";
  contenido: string;
  enviado_at: string;
  leido: boolean;
}

/**
 * Conversaciones del gym, más recientes primero. Trae el nombre del miembro
 * vinculado (si hay) y un preview del último mensaje.
 */
export async function listConversaciones(
  tenantId: string,
  limit = 50
): Promise<ConversacionResumen[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wa_conversaciones")
    .select(
      "id, telefono, nombre_contacto, miembro_id, ultimo_mensaje_at, no_leidos, bot_activo, miembros(nombre)"
    )
    .eq("tenant_id", tenantId)
    .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  const convs = data ?? [];
  if (convs.length === 0) return [];

  // Preview del último mensaje de cada conversación (una sola consulta).
  const ids = convs.map((c) => c.id as string);
  const { data: msgs } = await supabase
    .from("wa_mensajes")
    .select("conversacion_id, contenido, enviado_at")
    .in("conversacion_id", ids)
    .order("enviado_at", { ascending: false });

  const preview = new Map<string, string>();
  for (const m of msgs ?? []) {
    const cid = m.conversacion_id as string;
    if (!preview.has(cid)) preview.set(cid, m.contenido as string);
  }

  return convs.map((c) => {
    const miembro = c.miembros as { nombre: string } | { nombre: string }[] | null;
    const miembroNombre = Array.isArray(miembro)
      ? miembro[0]?.nombre ?? null
      : miembro?.nombre ?? null;
    return {
      id: c.id as string,
      telefono: c.telefono as string,
      nombre_contacto: (c.nombre_contacto as string | null) ?? null,
      miembro_id: (c.miembro_id as string | null) ?? null,
      miembro_nombre: miembroNombre,
      ultimo_mensaje_at: (c.ultimo_mensaje_at as string | null) ?? null,
      no_leidos: (c.no_leidos as number) ?? 0,
      bot_activo: (c.bot_activo as boolean) ?? true,
      ultimo_mensaje: preview.get(c.id as string) ?? null,
    };
  });
}

/** Mensajes de una conversación en orden cronológico (más viejos primero). */
export async function getMensajes(
  tenantId: string,
  conversacionId: string,
  limit = 50
): Promise<MensajeInbox[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wa_mensajes")
    .select("id, direccion, tipo, contenido, enviado_at, leido")
    .eq("tenant_id", tenantId)
    .eq("conversacion_id", conversacionId)
    .order("enviado_at", { ascending: false })
    .limit(limit);

  // Traemos los últimos `limit` (desc) y los devolvemos en orden cronológico.
  return (data ?? [])
    .map((m) => ({
      id: m.id as string,
      direccion: m.direccion as "entrante" | "saliente",
      tipo: m.tipo as "texto" | "template" | "bot",
      contenido: m.contenido as string,
      enviado_at: m.enviado_at as string,
      leido: (m.leido as boolean) ?? false,
    }))
    .reverse();
}

/** Total de mensajes sin leer del gym (para el badge del sidebar). */
export async function countNoLeidos(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wa_conversaciones")
    .select("no_leidos")
    .eq("tenant_id", tenantId);
  return (data ?? []).reduce((s, c) => s + ((c.no_leidos as number) ?? 0), 0);
}

/** Marca la conversación como leída: contador a 0 y mensajes como leídos. */
export async function marcarConversacionLeida(
  tenantId: string,
  conversacionId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("wa_conversaciones")
    .update({ no_leidos: 0 })
    .eq("tenant_id", tenantId)
    .eq("id", conversacionId);
  await supabase
    .from("wa_mensajes")
    .update({ leido: true })
    .eq("tenant_id", tenantId)
    .eq("conversacion_id", conversacionId)
    .eq("leido", false);
}

/** Alterna el bot para una conversación y devuelve el nuevo estado. */
export async function toggleBot(
  tenantId: string,
  conversacionId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("wa_conversaciones")
    .select("bot_activo")
    .eq("tenant_id", tenantId)
    .eq("id", conversacionId)
    .maybeSingle();
  if (!conv) return true;
  const nuevo = !(conv.bot_activo as boolean);
  await supabase
    .from("wa_conversaciones")
    .update({ bot_activo: nuevo })
    .eq("tenant_id", tenantId)
    .eq("id", conversacionId);
  return nuevo;
}

/**
 * Envía un mensaje manual del dueño por WhatsApp y lo registra en el inbox.
 * Devuelve ok:false con motivo si la conversación no existe o falta la
 * credencial de WhatsApp del gym.
 */
export async function enviarMensajeManual(
  tenantId: string,
  conversacionId: string,
  texto: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("wa_conversaciones")
    .select("telefono")
    .eq("tenant_id", tenantId)
    .eq("id", conversacionId)
    .maybeSingle();
  if (!conv) return { ok: false, error: "Conversación no encontrada." };

  const { data: gym } = await supabase
    .from("gyms")
    .select("whatsapp_api_key")
    .eq("id", tenantId)
    .maybeSingle();
  const apiKey = (gym?.whatsapp_api_key as string | null) ?? null;
  if (!apiKey) {
    return { ok: false, error: "El gym no tiene WhatsApp configurado." };
  }

  const telefono = conv.telefono as string;
  const enviado = await sendWhatsappText(telefono, texto, apiKey);
  if (!enviado) return { ok: false, error: "No se pudo enviar el mensaje." };

  await registrarMensaje({
    tenantId,
    telefono,
    direccion: "saliente",
    tipo: "texto",
    contenido: texto,
  });
  // El dueño acaba de ver la conversación al responder.
  await marcarConversacionLeida(tenantId, conversacionId);

  return { ok: true };
}
