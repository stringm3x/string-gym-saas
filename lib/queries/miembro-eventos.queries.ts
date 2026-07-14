/**
 * Eventos del socio (D1 congelar, D2 cambio de plan). Timeline unificado en
 * `miembro_eventos`. Congelar recorre el vencimiento +N días (no se pierden
 * días pagados) y bloquea el check-in en el rango. Cambiar plan reasigna el
 * plan y recalcula la vigencia a hoy + duración del nuevo (administrativo, sin
 * cobro).
 */
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyISO, isoMasDias } from "@/lib/utils/dates";

export interface EventoMiembro {
  id: string;
  tipo: "congelacion" | "cambio_plan";
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string | null;
  creado_por_nombre: string | null;
  descripcion: string | null;
  created_at: string;
}

function diasEntre(inicio: string, fin: string): number {
  const a = new Date(inicio + "T00:00:00").getTime();
  const b = new Date(fin + "T00:00:00").getTime();
  return Math.round((b - a) / 86_400_000) + 1; // inclusivo
}

/** Congela la membresía: extiende el vencimiento y registra el evento (D1). */
export async function congelarMembresia(
  tenantId: string,
  miembroId: string,
  input: {
    fechaInicio: string;
    fechaFin: string;
    userId: string | null;
    nombre: string | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (input.fechaFin < input.fechaInicio) {
    return { ok: false, error: "El fin debe ser igual o posterior al inicio." };
  }

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("miembros")
    .select("fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  if (!m) return { ok: false, error: "Miembro no encontrado." };

  const dias = diasEntre(input.fechaInicio, input.fechaFin);

  // Recorre el vencimiento +dias (si tiene). Los días congelados no se pierden.
  if (m.fecha_vencimiento) {
    const nuevoVenc = isoMasDias(dias, m.fecha_vencimiento as string);
    await supabase
      .from("miembros")
      .update({ fecha_vencimiento: nuevoVenc })
      .eq("tenant_id", tenantId)
      .eq("id", miembroId);
  }

  const { error } = await supabase.from("miembro_eventos").insert({
    tenant_id: tenantId,
    miembro_id: miembroId,
    tipo: "congelacion",
    fecha_inicio: input.fechaInicio,
    fecha_fin: input.fechaFin,
    estado: "activa",
    creado_por: input.userId,
    creado_por_nombre: input.nombre,
    descripcion: `Congelación de ${dias} día${dias === 1 ? "" : "s"}`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** ¿El socio tiene una congelación activa que cubre hoy? (bloqueo de check-in). */
export async function congelacionActiva(
  tenantId: string,
  miembroId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const hoy = hoyISO();
  const { data } = await supabase
    .from("miembro_eventos")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("tipo", "congelacion")
    .eq("estado", "activa")
    .lte("fecha_inicio", hoy)
    .gte("fecha_fin", hoy)
    .limit(1);
  return (data ?? []).length > 0;
}

/** Cambia el plan del socio (administrativo, sin cobro) y lo registra (D2). */
export async function cambiarPlan(
  tenantId: string,
  miembroId: string,
  nuevoPlanId: string,
  input: { userId: string | null; nombre: string | null }
): Promise<{ ok: boolean; error?: string; nuevoVencimiento?: string }> {
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("miembros")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  if (!m) return { ok: false, error: "Miembro no encontrado." };

  const { data: plan } = await supabase
    .from("planes_membresia")
    .select("nombre, dias_duracion, tipo, visitas")
    .eq("tenant_id", tenantId)
    .eq("id", nuevoPlanId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan no encontrado." };

  const visitasRestantes =
    plan.tipo === "visitas" || plan.tipo === "paquete"
      ? (plan.visitas as number | null)
      : null;

  const planAnteriorId = (m.plan_id as string | null) ?? null;
  let anteriorNombre: string | null = null;
  if (planAnteriorId) {
    const { data: prev } = await supabase
      .from("planes_membresia")
      .select("nombre")
      .eq("id", planAnteriorId)
      .maybeSingle();
    anteriorNombre = (prev?.nombre as string | null) ?? null;
  }

  const nuevoVenc = isoMasDias(plan.dias_duracion as number);

  await supabase
    .from("miembros")
    .update({
      plan_id: nuevoPlanId,
      fecha_vencimiento: nuevoVenc,
      estado: "activo",
      visitas_restantes: visitasRestantes,
    })
    .eq("tenant_id", tenantId)
    .eq("id", miembroId);

  const { error } = await supabase.from("miembro_eventos").insert({
    tenant_id: tenantId,
    miembro_id: miembroId,
    tipo: "cambio_plan",
    plan_anterior_id: planAnteriorId,
    plan_nuevo_id: nuevoPlanId,
    creado_por: input.userId,
    creado_por_nombre: input.nombre,
    descripcion: `Cambio de plan: ${anteriorNombre ?? "—"} → ${plan.nombre}`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, nuevoVencimiento: nuevoVenc };
}

/** Timeline de eventos del socio (D1/D2). */
export async function getEventosMiembro(
  tenantId: string,
  miembroId: string
): Promise<EventoMiembro[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembro_eventos")
    .select(
      "id, tipo, fecha_inicio, fecha_fin, estado, creado_por_nombre, descripcion, created_at"
    )
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((e) => ({
    id: e.id as string,
    tipo: e.tipo as "congelacion" | "cambio_plan",
    fecha_inicio: (e.fecha_inicio as string | null) ?? null,
    fecha_fin: (e.fecha_fin as string | null) ?? null,
    estado: (e.estado as string | null) ?? null,
    creado_por_nombre: (e.creado_por_nombre as string | null) ?? null,
    descripcion: (e.descripcion as string | null) ?? null,
    created_at: e.created_at as string,
  }));
}
