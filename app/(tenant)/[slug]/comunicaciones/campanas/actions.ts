"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import {
  getDestinatariosByAudiencia,
  createCampana,
  type Destinatario,
} from "@/lib/queries/campanas.queries";
import { enviarCampanaWhatsapp } from "@/lib/whatsapp/emit";
import { campanaInputSchema } from "@/lib/validations/campanas.schema";

/** Compone el mensaje por destinatario (mismas variables que el wizard). */
function renderMensaje(msg: string, d: Destinatario): string {
  const venc = d.fecha_vencimiento
    ? new Date(d.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
      })
    : "";
  return msg
    .replaceAll("{nombre}", d.nombre)
    .replaceAll("{fecha_vencimiento}", venc);
}

/**
 * Registra una campaña y, si el gym tiene WhatsApp activo, la envía por la API
 * (plantilla 'campana') a cada destinatario. Si no hay WhatsApp activo, el
 * cliente cae al modo wa.me manual. El total se recalcula server-side.
 */
export async function enviarCampanaAction(
  input: unknown
): Promise<{
  ok: boolean;
  error?: string;
  total?: number;
  enviadoPorApi?: boolean;
  enviados?: number;
}> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "campanas")) {
    return { ok: false, error: "Tu plan no incluye Campañas." };
  }

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

  revalidatePath(`/${tenant.slug}/comunicaciones/campanas`);
  return {
    ok: true,
    total: destinatarios.length,
    enviadoPorApi: wa.activo,
    enviados: wa.enviados,
  };
}
