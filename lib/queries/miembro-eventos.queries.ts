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
import { crearNotaCredito } from "@/lib/queries/notas-credito.queries";

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

/** Por qué no se calculó prorrateo (ver calcularCambioPlan): el caller lo
 * traduce a un mensaje para el usuario. */
export type CambioPlanSinProrrateoMotivo =
  | "sin_plan_actual"
  | "plan_por_visitas"
  | "vencido"
  | "sin_pago_vigente";

export type CambioPlanCalculo =
  | {
      tipo: "prorrateo";
      /** Días no consumidos del periodo vigente (incluye hoy). */
      diasRestantes: number;
      /** Valor de esos días sobre lo que el socio REALMENTE pagó (no el
       * precio de lista — pudo haber comprado con promoción). */
      valorDiasRestantes: number;
      /** Días del plan nuevo que cubre ese saldo, redondeados hacia abajo:
       * nunca se regala una fracción de día que el saldo no cubre completa. */
      diasNuevoPlan: number;
      /** true si el saldo alcanzó para un periodo completo del plan nuevo. */
      diasCompletos: boolean;
      /** Excedente (solo si diasCompletos) que se emite como nota de
       * crédito en vez de perderse. */
      notaCredito: number;
      nuevoVencimiento: string;
    }
  | {
      tipo: "sin_prorrateo";
      motivo: CambioPlanSinProrrateoMotivo;
      /** Comportamiento de siempre: hoy + duración del plan nuevo. */
      nuevoVencimiento: string;
    };

/**
 * Calcula el prorrateo de un cambio de plan (D2, ver también cambiarPlan) sin
 * escribir nada — lo usan tanto la previsualización (el cajero debe ver la
 * cuenta antes de confirmar) como cambiarPlan (para no calcular dos veces con
 * la posibilidad de que diverjan).
 *
 * El saldo a favor es la parte proporcional de los días no consumidos del
 * periodo vigente, valuada sobre lo que el socio REALMENTE pagó (el pago que
 * dejó fecha_vencimiento como está) — no el precio de lista del plan actual,
 * porque pudo haber comprado con promoción. Ese saldo se convierte en días
 * del plan nuevo a su precio de lista: si el nuevo es más caro, se traduce en
 * menos días de los que le quedaban; si sobra dinero después de completar un
 * periodo entero del plan nuevo, el excedente se emite como nota de crédito
 * (mismo mecanismo que un reembolso) en vez de perderse.
 *
 * Sin prorrateo (cae al comportamiento de siempre: hoy + duración del nuevo
 * plan, sin crédito) cuando:
 *  - El socio no tiene plan actual (alta nueva vía cambio de plan).
 *  - El plan actual es por visitas puras ('visitas'): no tiene un periodo en
 *    días del que prorratear (vigente mientras visitas_restantes > 0, sin
 *    fecha ancla). 'paquete' SÍ tiene fecha_vencimiento real y se prorratea
 *    igual que 'tiempo'.
 *  - La membresía ya venció: no quedan días que valgan algo.
 *  - No se encuentra el pago que dejó la fecha_vencimiento actual, ni un
 *    gap explicable por congelaciones posteriores a ese pago (dato
 *    incompleto o vencimiento movido por otra vía — no hay de dónde tomar
 *    "lo que realmente pagó" con confianza).
 *
 * Un socio congelado SÍ se prorratea: la congelación ya recorrió
 * fecha_vencimiento hacia adelante (extenderVencimiento), así que esos días
 * ya están contados en el vencimiento vigente — no hay nada que perder por
 * dejarlo pasar (ver el lookup del pago vigente, más abajo).
 */
export async function calcularCambioPlan(
  tenantId: string,
  miembroId: string,
  nuevoPlanId: string,
  client?: SupabaseClient
): Promise<{ ok: true; calculo: CambioPlanCalculo } | { ok: false; error: string }> {
  const supabase = client ?? (await createClient());

  const [miembroRes, planNuevoRes] = await Promise.all([
    supabase
      .from("miembros")
      .select("plan_id, fecha_vencimiento")
      .eq("tenant_id", tenantId)
      .eq("id", miembroId)
      .maybeSingle(),
    supabase
      .from("planes_membresia")
      .select("precio, dias_duracion")
      .eq("tenant_id", tenantId)
      .eq("id", nuevoPlanId)
      .maybeSingle(),
  ]);
  const miembro = miembroRes.data;
  const planNuevo = planNuevoRes.data;
  if (!miembro) return { ok: false, error: "Miembro no encontrado." };
  if (!planNuevo) return { ok: false, error: "Plan no encontrado." };

  const diasDuracionNuevo = planNuevo.dias_duracion as number;
  const sinProrrateo = (
    motivo: CambioPlanSinProrrateoMotivo
  ): CambioPlanCalculo => ({
    tipo: "sin_prorrateo",
    motivo,
    nuevoVencimiento: isoMasDias(diasDuracionNuevo),
  });

  const planActualId = miembro.plan_id as string | null;
  if (!planActualId) {
    return { ok: true, calculo: sinProrrateo("sin_plan_actual") };
  }

  const { data: planActual } = await supabase
    .from("planes_membresia")
    .select("tipo")
    .eq("tenant_id", tenantId)
    .eq("id", planActualId)
    .maybeSingle();
  if (!planActual || planActual.tipo === "visitas") {
    return { ok: true, calculo: sinProrrateo("plan_por_visitas") };
  }

  const hoy = hoyISO();
  const vencimiento = miembro.fecha_vencimiento as string | null;
  if (!vencimiento || vencimiento < hoy) {
    return { ok: true, calculo: sinProrrateo("vencido") };
  }

  // El pago que dejó fecha_vencimiento como está — ese es "lo que realmente
  // pagó" por el periodo vigente (mismo criterio que anularPago usa para
  // encontrar "el pago vigente" de un miembro). No se exige periodo_fin =
  // vencimiento exacto: una congelación recorre fecha_vencimiento hacia
  // adelante (extenderVencimiento) sin tocar el periodo_fin del pago
  // original, así que tras congelar ya no coinciden — y esos días ya están
  // contemplados en fecha_vencimiento, no hay razón para no prorratearlos.
  const { data: pagoVigente } = await supabase
    .from("pagos")
    .select("monto, periodo_inicio, periodo_fin, created_at")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("concepto", "membresia")
    .lte("periodo_fin", vencimiento)
    .is("anulado_at", null)
    .is("reembolsado_at", null)
    .order("periodo_fin", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pagoVigente || !pagoVigente.periodo_inicio) {
    return { ok: true, calculo: sinProrrateo("sin_pago_vigente") };
  }

  const diasTotales = diasEntre(
    pagoVigente.periodo_inicio as string,
    pagoVigente.periodo_fin as string
  );
  if (diasTotales <= 0) {
    return { ok: true, calculo: sinProrrateo("sin_pago_vigente") };
  }

  // El gap entre lo que pagó y el vencimiento actual solo es válido si se
  // explica por congelaciones aplicadas después de este pago — si no, es un
  // vencimiento que se movió por otra vía (ej. un cambio de plan anterior,
  // administrativo y sin pago) y no hay base confiable para prorratear.
  // Cota superior a favor del socio: se usa el rango SOLICITADO de cada
  // congelación (fecha_inicio→fecha_fin), no los días netos consumidos —
  // eso no se puede reconstruir con precisión si hubo una descongelación
  // anticipada (el registro de "días devueltos" es texto, no una columna).
  const gapDias =
    diasEntre(pagoVigente.periodo_fin as string, vencimiento) - 1;
  if (gapDias > 0) {
    const { data: congelaciones } = await supabase
      .from("miembro_eventos")
      .select("fecha_inicio, fecha_fin")
      .eq("tenant_id", tenantId)
      .eq("miembro_id", miembroId)
      .eq("tipo", "congelacion")
      .not("fecha_inicio", "is", null)
      .gt("created_at", pagoVigente.created_at as string);
    const diasCongelados = (congelaciones ?? []).reduce(
      (s, c) =>
        s + diasEntre(c.fecha_inicio as string, c.fecha_fin as string),
      0
    );
    if (gapDias > diasCongelados) {
      return { ok: true, calculo: sinProrrateo("sin_pago_vigente") };
    }
  }

  const diasRestantes = diasEntre(hoy, vencimiento);
  const valorDia = Number(pagoVigente.monto) / diasTotales;
  const saldoAFavor = Math.round(valorDia * diasRestantes * 100) / 100;

  const precioNuevo = Number(planNuevo.precio);
  const valorDiaNuevo = precioNuevo / diasDuracionNuevo;
  const diasNuevoPlanCrudo = valorDiaNuevo > 0 ? saldoAFavor / valorDiaNuevo : 0;

  // Días completos hacia abajo — nunca se regala una fracción de día que el
  // saldo no cubre completa — pero lo que sobra no se pierde: se convierte
  // en nota de crédito (mismo excedente de "alcanzó y sobró un periodo
  // completo", o el valor de la fracción de día cuando no alcanzó para uno).
  // Redondear hacia abajo sin esto era dinero del socio que se evaporaba en
  // cada cambio de plan.
  let diasNuevoPlan: number;
  let diasCompletos: boolean;
  let notaCredito = 0;
  if (diasNuevoPlanCrudo >= diasDuracionNuevo) {
    diasNuevoPlan = diasDuracionNuevo;
    diasCompletos = true;
    const excedente = saldoAFavor - precioNuevo;
    notaCredito = excedente > 0.005 ? Math.round(excedente * 100) / 100 : 0;
  } else {
    diasNuevoPlan = Math.max(0, Math.floor(diasNuevoPlanCrudo));
    diasCompletos = false;
    const fraccionDias = diasNuevoPlanCrudo - diasNuevoPlan;
    const excedente = fraccionDias * valorDiaNuevo;
    notaCredito = excedente > 0.005 ? Math.round(excedente * 100) / 100 : 0;
  }

  return {
    ok: true,
    calculo: {
      tipo: "prorrateo",
      diasRestantes,
      valorDiasRestantes: saldoAFavor,
      diasNuevoPlan,
      diasCompletos,
      notaCredito,
      nuevoVencimiento: isoMasDias(Math.max(diasNuevoPlan - 1, 0)),
    },
  };
}

/**
 * Cambia el plan del socio (D2). Prorratea contra el periodo vigente (ver
 * calcularCambioPlan) — antes era puramente administrativo: vencimiento =
 * hoy + duración del nuevo plan, sin importar cuántos días pagados quedaban
 * (de Mensual a Trimestral el día 25 regalaba 90 días; a Semanal el día 3
 * perdía 20 días ya pagados).
 */
export async function cambiarPlan(
  tenantId: string,
  miembroId: string,
  nuevoPlanId: string,
  input: { userId: string | null; nombre: string | null }
): Promise<{
  ok: boolean;
  error?: string;
  nuevoVencimiento?: string;
  notaCredito?: number;
}> {
  const supabase = await createClient();

  // Sin bloqueo por congelación: extenderVencimiento ya recorrió
  // fecha_vencimiento hacia adelante por los días de la pausa, así que
  // calcularCambioPlan prorratea sobre esa vigencia extendida sin perder
  // nada (ver el comentario junto al lookup del pago vigente, ahí abajo).
  const calc = await calcularCambioPlan(tenantId, miembroId, nuevoPlanId, supabase);
  if (!calc.ok) return { ok: false, error: calc.error };

  const { data: m } = await supabase
    .from("miembros")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  if (!m) return { ok: false, error: "Miembro no encontrado." };

  const { data: plan } = await supabase
    .from("planes_membresia")
    .select("nombre, tipo, visitas")
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

  const nuevoVenc = calc.calculo.nuevoVencimiento;

  const { error: updErr } = await supabase
    .from("miembros")
    .update({
      plan_id: nuevoPlanId,
      fecha_vencimiento: nuevoVenc,
      estado: "activo",
      visitas_restantes: visitasRestantes,
    })
    .eq("tenant_id", tenantId)
    .eq("id", miembroId);
  if (updErr) return { ok: false, error: updErr.message };

  // Excedente del prorrateo (plan nuevo más barato, alcanzó y sobró) → nota
  // de crédito, mismo mecanismo que un reembolso. Best-effort: si falla no
  // deshacemos el cambio de plan ya aplicado, pero queda rastro visible.
  let notaCreditoEmitida = 0;
  if (calc.calculo.tipo === "prorrateo" && calc.calculo.notaCredito > 0) {
    const nota = await crearNotaCredito(supabase, tenantId, {
      miembroId,
      monto: calc.calculo.notaCredito,
      origenReembolsoId: null,
    });
    if (nota.ok) {
      notaCreditoEmitida = calc.calculo.notaCredito;
    } else {
      console.error(
        `[cambiarPlan] no se pudo emitir nota de crédito de ${calc.calculo.notaCredito} para ${miembroId}:`,
        nota.error
      );
    }
  }

  const detalleProrrateo =
    calc.calculo.tipo === "prorrateo"
      ? ` (${calc.calculo.diasRestantes}d restantes ≈ $${calc.calculo.valorDiasRestantes.toFixed(2)} → ${calc.calculo.diasNuevoPlan}d del plan nuevo${
          notaCreditoEmitida > 0
            ? `, $${notaCreditoEmitida.toFixed(2)} a nota de crédito`
            : ""
        })`
      : "";

  const { error } = await supabase.from("miembro_eventos").insert({
    tenant_id: tenantId,
    miembro_id: miembroId,
    tipo: "cambio_plan",
    plan_anterior_id: planAnteriorId,
    plan_nuevo_id: nuevoPlanId,
    creado_por: input.userId,
    creado_por_nombre: input.nombre,
    descripcion: `Cambio de plan: ${anteriorNombre ?? "—"} → ${plan.nombre}${detalleProrrateo}`,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    nuevoVencimiento: nuevoVenc,
    notaCredito: notaCreditoEmitida,
  };
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
