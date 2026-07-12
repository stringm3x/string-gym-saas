/**
 * Persistencia del inbox de WhatsApp (Fase 7.5C). Registra mensajes entrantes
 * y salientes en wa_conversaciones + wa_mensajes. Service-role (el webhook y el
 * cron no tienen sesión). Fire-and-forget: nunca lanza.
 *
 * La conversación se identifica por los ÚLTIMOS 10 dígitos del teléfono, para
 * que entrante (52155…) y saliente (10 dígitos del miembro) caigan en la misma.
 */
import { createAdminClient } from "@/lib/supabase/admin";

function ultimos10(s: string | null): string {
  return (s ?? "").replace(/\D/g, "").slice(-10);
}

export interface RegistrarMensajeParams {
  tenantId: string;
  telefono: string;
  direccion: "entrante" | "saliente";
  tipo: "texto" | "template" | "bot";
  contenido: string;
  miembroId?: string | null;
  nombreContacto?: string | null;
  metadata?: Record<string, unknown>;
}

export async function registrarMensaje(
  p: RegistrarMensajeParams
): Promise<void> {
  try {
    const admin = createAdminClient();
    const tel = ultimos10(p.telefono);
    if (tel.length < 8) return;

    // Resolver miembro por teléfono si no viene dado (match por últimos 10).
    let miembroId = p.miembroId ?? null;
    let nombre = p.nombreContacto ?? null;
    if (!miembroId) {
      const { data: miembros } = await admin
        .from("miembros")
        .select("id, nombre, telefono")
        .eq("tenant_id", p.tenantId)
        .eq("archivado", false);
      const m = (miembros ?? []).find(
        (x) => ultimos10(x.telefono as string | null) === tel
      );
      if (m) {
        miembroId = m.id as string;
        nombre = nombre ?? (m.nombre as string);
      }
    }

    const ahora = new Date().toISOString();
    const inc = p.direccion === "entrante" ? 1 : 0;

    // Asegura la conversación (upsert idempotente, sin pisar contadores).
    await admin.from("wa_conversaciones").upsert(
      {
        tenant_id: p.tenantId,
        telefono: tel,
        nombre_contacto: nombre,
        miembro_id: miembroId,
        ultimo_mensaje_at: ahora,
        no_leidos: 0,
      },
      { onConflict: "tenant_id,telefono", ignoreDuplicates: true }
    );

    const { data: conv } = await admin
      .from("wa_conversaciones")
      .select("id, no_leidos, miembro_id, nombre_contacto")
      .eq("tenant_id", p.tenantId)
      .eq("telefono", tel)
      .maybeSingle();
    if (!conv) return;

    await admin
      .from("wa_conversaciones")
      .update({
        ultimo_mensaje_at: ahora,
        no_leidos: (conv.no_leidos as number) + inc,
        miembro_id: (conv.miembro_id as string | null) ?? miembroId,
        nombre_contacto: (conv.nombre_contacto as string | null) ?? nombre,
      })
      .eq("id", conv.id as string);

    await admin.from("wa_mensajes").insert({
      tenant_id: p.tenantId,
      conversacion_id: conv.id as string,
      direccion: p.direccion,
      tipo: p.tipo,
      contenido: p.contenido,
      metadata: p.metadata ?? {},
    });
  } catch (err) {
    console.error("[wa] registrarMensaje:", err);
  }
}

/** ¿El bot está activo para este teléfono? Default true si no hay conversación. */
export async function botActivoDe(
  tenantId: string,
  telefono: string
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("wa_conversaciones")
      .select("bot_activo")
      .eq("tenant_id", tenantId)
      .eq("telefono", ultimos10(telefono))
      .maybeSingle();
    return data ? (data.bot_activo as boolean) : true;
  } catch {
    return true;
  }
}
