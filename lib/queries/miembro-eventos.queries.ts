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

/** Recorre el vencimiento +N días por una congelación (los días no se pierden). */
async function extenderVencimiento(
  supabase: SupabaseClient,
  tenantId: string,
  miembroId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<number> {
  const dias = diasEntre(fechaInicio, fechaFin);
  const { data: m } = await supabase
    .from("miembros")
    .select("fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  if (m?.fecha_vencimiento) {
    await supabase
      .from("miembros")
      .update({ fecha_vencimiento: isoMasDias(dias, m.fecha_vencimiento as string) })
      .eq("tenant_id", tenantId)
      .eq("id", miembroId);
  }
  return dias;
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
  const dias = await extenderVencimiento(
    supabase,
    tenantId,
    miembroId,
    input.fechaInicio,
    input.fechaFin
  );

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

/** ¿El gym auto-aprueba las solicitudes de congelación del portal? (D7). */
export async function congelacionAutoAprobar(
  tenantId: string,
  client: SupabaseClient
): Promise<boolean> {
  const { data } = await client
    .from("gyms")
    .select("congelacion_auto_aprobar")
    .eq("id", tenantId)
    .maybeSingle();
  return !!data?.congelacion_auto_aprobar;
}

/**
 * Solicitud de congelación desde el portal (D7). Si el gym auto-aprueba, aplica
 * la congelación de inmediato; si no, la deja 'solicitada' para que el dueño la
 * apruebe. Usa el client dado (admin en el portal).
 */
export async function solicitarCongelacionPortal(
  tenantId: string,
  miembroId: string,
  input: { fechaInicio: string; fechaFin: string },
  client: SupabaseClient
): Promise<{ ok: boolean; error?: string; aplicada: boolean }> {
  if (input.fechaFin < input.fechaInicio) {
    return {
      ok: false,
      error: "El fin debe ser igual o posterior al inicio.",
      aplicada: false,
    };
  }
  // Una sola solicitud/congelación pendiente a la vez.
  const { data: existente } = await client
    .from("miembro_eventos")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("tipo", "congelacion")
    .eq("estado", "solicitada")
    .limit(1);
  if ((existente ?? []).length > 0) {
    return { ok: false, error: "Ya tienes una solicitud pendiente.", aplicada: false };
  }

  const auto = await congelacionAutoAprobar(tenantId, client);
  const dias = diasEntre(input.fechaInicio, input.fechaFin);

  if (auto) {
    await extenderVencimiento(client, tenantId, miembroId, input.fechaInicio, input.fechaFin);
  }

  const { error } = await client.from("miembro_eventos").insert({
    tenant_id: tenantId,
    miembro_id: miembroId,
    tipo: "congelacion",
    fecha_inicio: input.fechaInicio,
    fecha_fin: input.fechaFin,
    estado: auto ? "activa" : "solicitada",
    creado_por_nombre: "Socio (portal)",
    descripcion: `${auto ? "Congelación" : "Solicitud de congelación"} de ${dias} día${dias === 1 ? "" : "s"}`,
  });
  if (error) return { ok: false, error: error.message, aplicada: false };
  return { ok: true, aplicada: auto };
}

/** Aprueba una solicitud de congelación (D7): aplica la pausa. */
export async function aprobarCongelacion(
  tenantId: string,
  eventoId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("miembro_eventos")
    .select("miembro_id, fecha_inicio, fecha_fin, estado")
    .eq("tenant_id", tenantId)
    .eq("id", eventoId)
    .eq("tipo", "congelacion")
    .maybeSingle();
  if (!ev || ev.estado !== "solicitada") {
    return { ok: false, error: "Solicitud no encontrada." };
  }

  await extenderVencimiento(
    supabase,
    tenantId,
    ev.miembro_id as string,
    ev.fecha_inicio as string,
    ev.fecha_fin as string
  );
  const { error } = await supabase
    .from("miembro_eventos")
    .update({ estado: "activa" })
    .eq("tenant_id", tenantId)
    .eq("id", eventoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Rechaza una solicitud de congelación (D7). */
export async function rechazarCongelacion(
  tenantId: string,
  eventoId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("miembro_eventos")
    .update({ estado: "cancelada" })
    .eq("tenant_id", tenantId)
    .eq("id", eventoId)
    .eq("tipo", "congelacion")
    .eq("estado", "solicitada");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** ¿El socio tiene una solicitud de congelación pendiente? (portal, admin). */
export async function tieneSolicitudCongelacion(
  tenantId: string,
  miembroId: string,
  client: SupabaseClient
): Promise<boolean> {
  const { data } = await client
    .from("miembro_eventos")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("tipo", "congelacion")
    .eq("estado", "solicitada")
    .limit(1);
  return (data ?? []).length > 0;
}

/** Solicitudes de congelación pendientes de un socio (para la ficha). */
export async function getCongelacionesSolicitadas(
  tenantId: string,
  miembroId: string
): Promise<{ id: string; fecha_inicio: string; fecha_fin: string; descripcion: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembro_eventos")
    .select("id, fecha_inicio, fecha_fin, descripcion")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("tipo", "congelacion")
    .eq("estado", "solicitada")
    .order("created_at", { ascending: false });
  return (data ?? []).map((e) => ({
    id: e.id as string,
    fecha_inicio: e.fecha_inicio as string,
    fecha_fin: e.fecha_fin as string,
    descripcion: (e.descripcion as string | null) ?? null,
  }));
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

/**
 * Descongela una membresía activa: devuelve al vencimiento los días de la pausa
 * NO consumidos (de hoy a fecha_fin), cierra la congelación y deja constancia
 * en el historial de quién descongeló y cuántos días devolvió. Los días ya
 * transcurridos de la pausa se respetan.
 */
export async function descongelarMembresia(
  tenantId: string,
  miembroId: string,
  creadoPor: { userId: string | null; nombre: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const hoy = hoyISO();

  // Congelación activa ya iniciada. Si hubiera varias, la de fin más lejano.
  const { data: ev } = await supabase
    .from("miembro_eventos")
    .select("id, fecha_fin")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("tipo", "congelacion")
    .eq("estado", "activa")
    .lte("fecha_inicio", hoy)
    .order("fecha_fin", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ev) return { ok: false, error: "No hay congelación activa." };

  // Días no consumidos = fecha_fin − hoy. diasEntre es inclusivo en ambos
  // extremos, por eso restamos 1 (hoy ya se consumió). Nunca negativo.
  const diasNoConsumidos = Math.max(
    0,
    diasEntre(hoy, ev.fecha_fin as string) - 1
  );

  // Devolver esos días: recorta la extensión que la congelación había aplicado.
  if (diasNoConsumidos > 0) {
    const { data: m } = await supabase
      .from("miembros")
      .select("fecha_vencimiento")
      .eq("tenant_id", tenantId)
      .eq("id", miembroId)
      .maybeSingle();
    if (m?.fecha_vencimiento) {
      await supabase
        .from("miembros")
        .update({
          fecha_vencimiento: isoMasDias(
            -diasNoConsumidos,
            m.fecha_vencimiento as string
          ),
        })
        .eq("tenant_id", tenantId)
        .eq("id", miembroId);
    }
  }

  // Cerrar la congelación → vuelve a mostrarse "Congelar" en la ficha.
  const { error: updErr } = await supabase
    .from("miembro_eventos")
    .update({ estado: "cancelada" })
    .eq("tenant_id", tenantId)
    .eq("id", ev.id);
  if (updErr) return { ok: false, error: updErr.message };

  // Constancia en el historial (evento propio, sin rango de fechas).
  const plural = diasNoConsumidos === 1 ? "" : "s";
  await supabase.from("miembro_eventos").insert({
    tenant_id: tenantId,
    miembro_id: miembroId,
    tipo: "congelacion",
    estado: "cancelada",
    creado_por: creadoPor.userId,
    creado_por_nombre: creadoPor.nombre,
    descripcion: `Descongelación — ${diasNoConsumidos} día${plural} devuelto${plural}`,
  });

  return { ok: true };
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
