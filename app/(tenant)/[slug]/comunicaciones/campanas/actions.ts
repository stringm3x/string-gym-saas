"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import {
  getDestinatariosByAudiencia,
  createCampana,
  marcarCampanaEnviada,
  getCampanaById,
  type Destinatario,
} from "@/lib/queries/campanas.queries";
import { enviarCampanaWhatsapp } from "@/lib/whatsapp/emit";
import { campanaInputSchema } from "@/lib/validations/campanas.schema";
import { compilarPlantilla } from "@/lib/utils/plantilla";

/** Compone el mensaje por destinatario (mismas variables que el wizard). */
function renderMensaje(msg: string, d: Destinatario): string {
  const venc = d.fecha_vencimiento
    ? new Date(d.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
      })
    : "";
  return compilarPlantilla(msg, { nombre: d.nombre, fecha_vencimiento: venc });
}

/**
 * Registra una campaña y, si el gym tiene WhatsApp activo, la envía por la API
 * (plantilla 'campana') a cada destinatario. Si no hay WhatsApp activo, el
 * cliente cae al modo wa.me manual. El total se recalcula server-side.
 */
export const enviarCampanaAction = panelAction(
  "campanas.enviar",
  {},
  async (
    tenant,
    input: unknown
  ): Promise<{
    ok: boolean;
    error?: string;
    campanaId?: string;
    total?: number;
    enviadoPorApi?: boolean;
    enviados?: number;
    fallidos?: number;
  }> => {
    const parsed = campanaInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sesión no válida." };

    const { destinatarios } = await getDestinatariosByAudiencia(
      tenant.id,
      parsed.data.audiencia
    );

    const r = await createCampana(
      tenant.id,
      parsed.data,
      destinatarios.length,
      user.id
    );
    if (!r.ok) return { ok: false, error: r.error };

    // Envío real por WhatsApp si el gym lo tiene activo (plantilla 'campana').
    const wa = await enviarCampanaWhatsapp(
      tenant.id,
      destinatarios.map((d) => ({
        telefono: d.telefono,
        mensaje: renderMensaje(parsed.data.mensaje, d),
      }))
    );

    // Se confirma "enviada" solo si de verdad se intentó por la API — el modo
    // manual (wa.me) se confirma aparte, cuando el staff termina de mandar
    // los links (marcarCampanaEnviadaManualAction).
    if (wa.activo) {
      await marcarCampanaEnviada(tenant.id, r.campana.id, "api");
    }

    revalidatePath(`/${tenant.slug}/comunicaciones/campanas`);
    return {
      ok: true,
      campanaId: r.campana.id,
      total: destinatarios.length,
      enviadoPorApi: wa.activo,
      enviados: wa.enviados,
      fallidos: wa.fallidos,
    };
  }
);

/**
 * Confirma una campaña en modo manual (wa.me) una vez que el staff terminó
 * de abrir los chats — antes no existía este paso, así que el historial
 * nunca sabía si el envío manual de verdad se completó.
 */
export const marcarCampanaEnviadaManualAction = panelAction(
  "campanas.confirmar_manual",
  {},
  async (tenant, campanaId: string): Promise<{ ok: boolean }> => {
    await marcarCampanaEnviada(tenant.id, campanaId, "manual");
    revalidatePath(`/${tenant.slug}/comunicaciones/campanas`);
    return { ok: true };
  }
);

/**
 * Recalcula los links wa.me de una campaña YA CREADA, sin crear una fila
 * nueva — antes "rehacer" el envío manual significaba pasar todo el wizard
 * de nuevo, lo que duplicaba la campaña en el historial.
 */
export const reabrirCampanaManualAction = panelAction(
  "campanas.reabrir_manual",
  {},
  async (
    tenant,
    campanaId: string
  ): Promise<
    | { ok: true; nombre: string; mensaje: string; destinatarios: Destinatario[] }
    | { ok: false; error: string }
  > => {
    const campana = await getCampanaById(tenant.id, campanaId);
    if (!campana) return { ok: false, error: "Campaña no encontrada." };

    const { destinatarios } = await getDestinatariosByAudiencia(
      tenant.id,
      campana.audiencia
    );
    return {
      ok: true,
      nombre: campana.nombre,
      mensaje: campana.mensaje,
      destinatarios,
    };
  }
);
