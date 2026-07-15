import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarMensajeBot } from "@/lib/whatsapp/bot";
import { sendWhatsappText } from "@/lib/whatsapp/360dialog";
import { dentroDeLimite } from "@/lib/whatsapp/rate-limit";
import { registrarMensaje, botActivoDe } from "@/lib/whatsapp/registro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Webhook entrante de 360dialog para el bot de WhatsApp (Fase 7.5B).
 * n8n recibe el mensaje de 360dialog y lo reenvía aquí con X-Webhook-Secret.
 * Extrae texto + remitente, corre el bot y responde por 360dialog.
 *
 * Devuelve 200 casi siempre (para no gatillar reintentos); 401 solo si el
 * secreto está configurado y no coincide.
 */

/** Extrae el primer mensaje de texto de los formatos v1 y Cloud de 360dialog. */
function extraerMensaje(body: unknown): { from: string; texto: string } | null {
  const b = body as {
    messages?: unknown;
    entry?: Array<{ changes?: Array<{ value?: { messages?: unknown } }> }>;
  };
  const raw = b?.messages ?? b?.entry?.[0]?.changes?.[0]?.value?.messages;
  const msgs = Array.isArray(raw) ? raw : [];
  const m = msgs[0] as
    | { from?: unknown; type?: unknown; text?: { body?: unknown } }
    | undefined;
  if (!m || m.type !== "text") return null;
  const from = typeof m.from === "string" ? m.from : "";
  const texto = typeof m.text?.body === "string" ? m.text.body : "";
  if (!from || !texto.trim()) return null;
  return { from, texto };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Auth: solo se exige si el secreto está configurado.
  const secreto = process.env.WHATSAPP_INCOMING_SECRET;
  if (secreto && request.headers.get("x-webhook-secret") !== secreto) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = extraerMensaje(body);
  if (!msg) return NextResponse.json({ ok: true }); // no es texto → nada que hacer

  // Gym: tenant + credencial para responder (si falta → no-op, dormido).
  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("id, whatsapp_api_key")
    .eq("slug", slug)
    .maybeSingle();
  if (!gym) return NextResponse.json({ ok: true });
  const tenantId = gym.id as string;
  const apiKey = (gym.whatsapp_api_key as string | null) ?? null;

  // Registrar el mensaje entrante en el inbox (siempre, aunque el bot no corra).
  await registrarMensaje({
    tenantId,
    telefono: msg.from,
    direccion: "entrante",
    tipo: "texto",
    contenido: msg.texto,
  });

  // Rate limit: 10 mensajes por número por hora.
  if (!dentroDeLimite(msg.from)) {
    await sendWhatsappText(
      msg.from,
      "Por favor espera un momento antes de enviar otro mensaje.",
      apiKey
    );
    return NextResponse.json({ ok: true });
  }

  // Si el dueño apagó el bot para esta conversación → solo se registró el
  // entrante; el dueño responde manual desde el inbox.
  if (!(await botActivoDe(tenantId, msg.from))) {
    return NextResponse.json({ ok: true });
  }

  // Bot + respuesta (fire dentro del request; Haiku es rápido).
  const respuesta = await procesarMensajeBot(msg.texto, msg.from, slug);
  await sendWhatsappText(msg.from, respuesta, apiKey);
  await registrarMensaje({
    tenantId,
    telefono: msg.from,
    direccion: "saliente",
    tipo: "bot",
    contenido: respuesta,
  });

  return NextResponse.json({ ok: true });
}
