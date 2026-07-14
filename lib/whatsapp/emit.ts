/**
 * Emisores de eventos WhatsApp para los flujos de negocio (Fase 7.5, Bloque 2).
 *
 * Cada `emit*` lee el gym + aplica el gate (feature 'whatsapp_automatico' +
 * whatsapp_activo), arma el evento y llama a notifyWhatsapp. Nunca lanzan y
 * hacen no-op instantáneo si N8N_WEBHOOK_URL no está (cero overhead dormido).
 *
 * Se llaman con `void emit*(...)` desde createPago/createMiembro/createProspecto
 * — fire-and-forget, jamás bloquean la operación principal. Leen las tablas por
 * admin client (evita ciclos con los módulos de queries y funciona sin sesión).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature, type Plan } from "@/lib/features";
import { notifyWhatsapp } from "./notify";
import { registrarMensaje } from "./registro";

interface GymCtx {
  id: string;
  slug: string;
  nombre: string;
  telefono: string | null; // owner
  whatsappNumero: string | null;
  whatsappApiKey: string | null;
}

/** Lee el gym y aplica el gate. Devuelve null si el gym no puede enviar. */
async function gymCtx(tenantId: string): Promise<GymCtx | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gyms")
    .select(
      "id, slug, nombre, telefono, plan, whatsapp_activo, whatsapp_numero, whatsapp_api_key"
    )
    .eq("id", tenantId)
    .maybeSingle();
  if (!data) return null;
  if (!hasFeature(data.plan as Plan, "whatsapp_automatico")) return null;
  if (!data.whatsapp_activo) return null;
  return {
    id: data.id as string,
    slug: data.slug as string,
    nombre: data.nombre as string,
    telefono: (data.telefono as string | null) ?? null,
    whatsappNumero: (data.whatsapp_numero as string | null) ?? null,
    whatsappApiKey: (data.whatsapp_api_key as string | null) ?? null,
  };
}

async function miembroCtx(tenantId: string, miembroId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("miembros")
    .select("nombre, telefono")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  if (!data) return null;
  return {
    nombre: data.nombre as string,
    telefono: (data.telefono as string | null) ?? null,
  };
}

async function nombrePlan(tenantId: string, planId: string | null): Promise<string> {
  if (!planId) return "";
  const admin = createAdminClient();
  const { data } = await admin
    .from("planes_membresia")
    .select("nombre")
    .eq("tenant_id", tenantId)
    .eq("id", planId)
    .maybeSingle();
  return (data?.nombre as string | undefined) ?? "";
}

/** PAGO_REGISTRADO — al miembro tras un cobro con miembro_id. */
export async function emitPagoRegistrado(p: {
  tenantId: string;
  miembroId: string;
  monto: number;
  planId: string | null;
  fechaVencimiento: string | null;
  reciboUrl?: string;
}): Promise<void> {
  if (!process.env.N8N_WEBHOOK_URL) return;
  try {
    const gym = await gymCtx(p.tenantId);
    if (!gym) return;
    const miembro = await miembroCtx(p.tenantId, p.miembroId);
    if (!miembro) return;
    await notifyWhatsapp({
      tipo: "PAGO_REGISTRADO",
      gymId: gym.id,
      gymSlug: gym.slug,
      gymNombre: gym.nombre,
      whatsappNumero: gym.whatsappNumero,
      whatsappApiKey: gym.whatsappApiKey,
      miembroNombre: miembro.nombre,
      miembroTelefono: miembro.telefono,
      monto: p.monto,
      planNombre: await nombrePlan(p.tenantId, p.planId),
      fechaVencimiento: p.fechaVencimiento,
      reciboUrl: p.reciboUrl,
    });
    // Reflejar el envío en el inbox (historial completo de la conversación).
    await registrarMensaje({
      tenantId: gym.id,
      telefono: miembro.telefono ?? "",
      direccion: "saliente",
      tipo: "template",
      contenido: `Pago registrado por $${p.monto.toLocaleString("es-MX")}. ¡Gracias!`,
      miembroId: p.miembroId,
      nombreContacto: miembro.nombre,
    });
  } catch (err) {
    console.error("[whatsapp] emitPagoRegistrado:", err);
  }
}

/** BIENVENIDA_MIEMBRO — al miembro recién inscrito. */
export async function emitBienvenidaMiembro(p: {
  tenantId: string;
  miembroId: string;
  planId: string | null;
  fechaVencimiento: string | null;
}): Promise<void> {
  if (!process.env.N8N_WEBHOOK_URL) return;
  try {
    const gym = await gymCtx(p.tenantId);
    if (!gym) return;
    const miembro = await miembroCtx(p.tenantId, p.miembroId);
    if (!miembro) return;
    await notifyWhatsapp({
      tipo: "BIENVENIDA_MIEMBRO",
      gymId: gym.id,
      gymSlug: gym.slug,
      gymNombre: gym.nombre,
      whatsappNumero: gym.whatsappNumero,
      whatsappApiKey: gym.whatsappApiKey,
      miembroNombre: miembro.nombre,
      miembroTelefono: miembro.telefono,
      planNombre: await nombrePlan(p.tenantId, p.planId),
      fechaVencimiento: p.fechaVencimiento ?? "",
    });
    // Reflejar el envío en el inbox.
    await registrarMensaje({
      tenantId: gym.id,
      telefono: miembro.telefono ?? "",
      direccion: "saliente",
      tipo: "template",
      contenido: `¡Bienvenido a ${gym.nombre}! Tu membresía ya está activa.`,
      miembroId: p.miembroId,
      nombreContacto: miembro.nombre,
    });
  } catch (err) {
    console.error("[whatsapp] emitBienvenidaMiembro:", err);
  }
}

/** PROSPECTO_NUEVO — al owner del gym cuando entra un prospecto. */
export async function emitProspectoNuevo(p: {
  tenantId: string;
  prospectoNombre: string;
  prospectoTelefono: string | null;
  planInteres: string | null;
  origen: string;
}): Promise<void> {
  if (!process.env.N8N_WEBHOOK_URL) return;
  try {
    const gym = await gymCtx(p.tenantId);
    if (!gym) return;
    await notifyWhatsapp({
      tipo: "PROSPECTO_NUEVO",
      gymId: gym.id,
      gymSlug: gym.slug,
      gymNombre: gym.nombre,
      whatsappNumero: gym.whatsappNumero,
      whatsappApiKey: gym.whatsappApiKey,
      ownerTelefono: gym.telefono,
      prospectoNombre: p.prospectoNombre,
      prospectoTelefono: p.prospectoTelefono,
      planInteres: p.planInteres,
      origen: p.origen,
    });
  } catch (err) {
    console.error("[whatsapp] emitProspectoNuevo:", err);
  }
}

/**
 * Campaña masiva (B6): envía un mensaje ya compuesto por destinatario vía el
 * motor (plantilla 'campana'). Aplica el gate del gym UNA vez y hace un envío
 * por cada teléfono. Devuelve si el envío por API está activo y cuántos salieron.
 */
export async function enviarCampanaWhatsapp(
  tenantId: string,
  destinatarios: { telefono: string; mensaje: string }[]
): Promise<{ activo: boolean; enviados: number }> {
  // Infra presente (Modo A n8n o Modo B 360dialog). Sin ella, dormido.
  const infra =
    !!process.env.N8N_WEBHOOK_URL || !!process.env.DIALOG360_API_KEY;
  if (!infra) return { activo: false, enviados: 0 };

  const gym = await gymCtx(tenantId);
  if (!gym) return { activo: false, enviados: 0 };

  const envios = destinatarios
    .filter((d) => d.telefono && d.mensaje.trim())
    .map((d) =>
      notifyWhatsapp({
        tipo: "CAMPANA",
        gymId: gym.id,
        gymSlug: gym.slug,
        gymNombre: gym.nombre,
        whatsappNumero: gym.whatsappNumero,
        whatsappApiKey: gym.whatsappApiKey,
        miembroTelefono: d.telefono,
        mensaje: d.mensaje,
      })
    );
  await Promise.allSettled(envios);
  return { activo: true, enviados: envios.length };
}

/**
 * VISITAS_BAJAS (D8): avisa al socio que le quedan pocas visitas. Fire-and-forget,
 * gateado y no-op si la infra está dormida.
 */
export async function emitVisitasBajas(
  tenantId: string,
  miembroId: string,
  visitasRestantes: number
): Promise<void> {
  const infra =
    !!process.env.N8N_WEBHOOK_URL || !!process.env.DIALOG360_API_KEY;
  if (!infra) return;
  try {
    const gym = await gymCtx(tenantId);
    if (!gym) return;
    const admin = createAdminClient();
    const { data: m } = await admin
      .from("miembros")
      .select("nombre, telefono")
      .eq("tenant_id", tenantId)
      .eq("id", miembroId)
      .maybeSingle();
    if (!m?.telefono) return;

    await notifyWhatsapp({
      tipo: "VISITAS_BAJAS",
      gymId: gym.id,
      gymSlug: gym.slug,
      gymNombre: gym.nombre,
      whatsappNumero: gym.whatsappNumero,
      whatsappApiKey: gym.whatsappApiKey,
      miembroTelefono: m.telefono as string,
      miembroNombre: (m.nombre as string) ?? "",
      visitasRestantes,
    });
  } catch (err) {
    console.error("[whatsapp] emitVisitasBajas:", err);
  }
}

/** ¿El gym puede enviar por WhatsApp? (feature + activo + infra). Para el portal. */
export async function gymPuedeWhatsapp(tenantId: string): Promise<boolean> {
  const infra =
    !!process.env.N8N_WEBHOOK_URL || !!process.env.DIALOG360_API_KEY;
  if (!infra) return false;
  return (await gymCtx(tenantId)) !== null;
}

/**
 * OTP del portal por WhatsApp (C3). Envía el código como plantilla. Devuelve
 * true si el gym pudo enviarlo (activo + infra), false si está dormido.
 */
export async function emitOtpWhatsapp(
  tenantId: string,
  telefono: string,
  codigo: string
): Promise<boolean> {
  const infra =
    !!process.env.N8N_WEBHOOK_URL || !!process.env.DIALOG360_API_KEY;
  if (!infra) return false;
  const gym = await gymCtx(tenantId);
  if (!gym || !telefono) return false;

  await notifyWhatsapp({
    tipo: "OTP",
    gymId: gym.id,
    gymSlug: gym.slug,
    gymNombre: gym.nombre,
    whatsappNumero: gym.whatsappNumero,
    whatsappApiKey: gym.whatsappApiKey,
    miembroTelefono: telefono,
    codigo,
  });
  return true;
}

/**
 * LISTA_ESPERA (C2): avisa al miembro que subió de lista de espera a confirmado.
 * Fire-and-forget, gateado y no-op si la infra está dormida.
 */
export async function emitListaEspera(
  tenantId: string,
  sesionId: string,
  miembroId: string
): Promise<void> {
  const infra =
    !!process.env.N8N_WEBHOOK_URL || !!process.env.DIALOG360_API_KEY;
  if (!infra) return;
  try {
    const gym = await gymCtx(tenantId);
    if (!gym) return;

    const admin = createAdminClient();
    const [miembroRes, sesionRes] = await Promise.all([
      admin
        .from("miembros")
        .select("nombre, telefono")
        .eq("tenant_id", tenantId)
        .eq("id", miembroId)
        .maybeSingle(),
      admin
        .from("clases_sesiones")
        .select("fecha, hora_inicio, clases(nombre)")
        .eq("tenant_id", tenantId)
        .eq("id", sesionId)
        .maybeSingle(),
    ]);
    const miembro = miembroRes.data;
    if (!miembro?.telefono) return;

    const claseRaw = sesionRes.data?.clases as
      | { nombre: string }
      | { nombre: string }[]
      | null;
    const claseNombre = Array.isArray(claseRaw)
      ? claseRaw[0]?.nombre ?? "tu clase"
      : claseRaw?.nombre ?? "tu clase";

    await notifyWhatsapp({
      tipo: "LISTA_ESPERA",
      gymId: gym.id,
      gymSlug: gym.slug,
      gymNombre: gym.nombre,
      whatsappNumero: gym.whatsappNumero,
      whatsappApiKey: gym.whatsappApiKey,
      miembroTelefono: miembro.telefono as string,
      miembroNombre: (miembro.nombre as string) ?? "",
      claseNombre,
      fecha: (sesionRes.data?.fecha as string) ?? "",
      hora: (sesionRes.data?.hora_inicio as string) ?? "",
    });
  } catch (err) {
    console.error("[whatsapp] emitListaEspera:", err);
  }
}
