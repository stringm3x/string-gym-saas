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
