import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PagoInput } from "@/lib/validations/pago.schema";
import type { VisitaRapidaInput } from "@/lib/validations/visita-rapida.schema";
import { generarTokenRecibo } from "@/lib/utils/tokens";
import { createNotification } from "@/lib/utils/notifications";
import { hoyCDMX, hoyISO, inicioDeMesCDMX, isoMasDias } from "@/lib/utils/dates";
import { emitPagoRegistrado } from "@/lib/whatsapp/emit";
import { getCajaDefault, resolverCajaDeVenta } from "@/lib/queries/cajas.queries";
import { logError } from "@/lib/log";
import { hasFeature, type Plan } from "@/lib/features";
import { sendRecibo } from "@/lib/email/send-recibo";

/**
 * Enlaza uno o más pagos ya creados a una caja (ver sql/063_cajas_multiples.sql).
 * Si no se especifica cajaId (pagos sin punto de venta físico: portal, kiosco,
 * MercadoPago, cuotas de crédito…), cae en la caja default del gym. Best-effort:
 * un fallo aquí no debe deshacer un cobro que ya se registró de verdad.
 * Exportada para que contextos sin sesión (el webhook de MercadoPago, con
 * el client admin) puedan reusarla igual que createPago.
 */
export async function registrarCajaDePagos(
  supabase: SupabaseClient,
  tenantId: string,
  pagoIds: string[],
  cajaId?: string
): Promise<void> {
  if (pagoIds.length === 0) return;
  try {
    let caja = cajaId;
    if (!caja) {
      // El mismo `supabase` que enlaza el pago resuelve la caja — con el
      // admin del webhook, sin esto getCajaDefault usaba su propio
      // createClient() de sesión (sin sesión aquí) y RLS lo dejaba en null
      // siempre, aunque sí hubiera caja default.
      const def = await getCajaDefault(tenantId, supabase);
      if (!def) {
        // El cobro ya se registró (el RPC de arriba ya corrió) — no lo
        // deshacemos por esto, pero sin caja el pago queda invisible para
        // cualquier corte. Antes este caso ni se logueaba.
        console.error(
          `[pagos] sin caja default para tenant ${tenantId}: pago(s) ${pagoIds.join(
            ", "
          )} quedan sin enlazar a ninguna caja. Créala en Configuración → Cajas.`
        );
        return;
      }
      caja = def.id;
    }
    const { error } = await supabase.from("pagos_caja").insert(
      pagoIds.map((pago_id) => ({
        tenant_id: tenantId,
        pago_id,
        caja_id: caja,
      }))
    );
    if (error) {
      console.error(
        `[pagos] no se pudo enlazar pago(s) ${pagoIds.join(
          ", "
        )} a la caja ${caja} (tenant ${tenantId}):`,
        error.message
      );
    }
  } catch (err) {
    console.error("[pagos] registrarCajaDePagos:", err);
  }
}

export type CategoriaCaja =
  | "all"
  | "membresia"
  | "producto"
  | "otros"
  | "visitas";

export interface Pago {
  id: string;
  tenant_id: string;
  miembro_id: string | null;
  concepto: "membresia" | "visita" | "producto" | "otro";
  monto: number;
  metodo_pago: "efectivo" | "tarjeta" | "transferencia" | null;
  fecha_pago: string;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  plan_id: string | null;
  promocion_id: string | null;
  producto_id: string | null;
  folio: number | null;
  es_visita_rapida: boolean;
  nombre_visitante: string | null;
  telefono_visitante: string | null;
  token_publico: string | null;
  anulado_at: string | null;
  reembolsado_at: string | null;
  reembolsado_motivo: string | null;
  ticket_id: string | null;
  created_at: string;
}

export interface PagoCompleto extends Pago {
  miembro_nombre: string | null;
  miembro_telefono: string | null;
  gym_nombre: string;
  gym_telefono: string | null;
  gym_direccion: string | null;
  gym_rfc: string | null;
  gym_logo_url: string | null;
}

export interface PagoConMiembro extends Pago {
  miembro_nombre: string | null;
}

/**
 * Registra un pago. Si concepto = membresia, actualiza fecha_vencimiento
 * del miembro a periodo_fin (operación secuencial — Supabase no soporta
 * transacciones multi-tabla desde el cliente JS sin RPC).
 */
export async function createPago(
  tenantId: string,
  input: PagoInput,
  cajaId?: string
): Promise<
  | {
      ok: true;
      id: string;
      token: string;
      /** undefined si el pago no tenía miembro (visita rápida sin socio). */
      reciboEnviado?: boolean;
      reciboError?: string;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const token = generarTokenRecibo();

  // Cobro atómico (Bug #5): pago + descuento de stock + extensión de membresía
  // en UNA transacción vía RPC de Postgres. Si algo falla, todo revierte.
  const { data: pagoId, error } = await supabase.rpc("registrar_pago", {
    p_tenant_id: tenantId,
    p_concepto: input.concepto,
    p_monto: input.monto,
    p_token: token,
    p_metodo_pago: input.metodo_pago,
    p_miembro_id: input.miembro_id || null,
    p_periodo_inicio: input.periodo_inicio || null,
    p_periodo_fin: input.periodo_fin || null,
    p_plan_id: input.plan_id || null,
    p_promocion_id: input.promocion_id || null,
    p_producto_id: input.producto_id || null,
    p_cantidad_producto: input.cantidad_producto ?? null,
  });

  if (error || !pagoId) {
    const msg = error?.message ?? "";
    if (msg.includes("STOCK_INSUFICIENTE")) {
      return { ok: false, error: "Stock insuficiente para completar la venta." };
    }
    if (msg.includes("INVENTARIO_NO_ENCONTRADO")) {
      return { ok: false, error: "No se encontró el inventario del producto." };
    }
    return { ok: false, error: msg || "No se pudo registrar el pago" };
  }

  const data = { id: pagoId as string };

  await registrarCajaDePagos(supabase, tenantId, [data.id], cajaId);

  // Notificación in-app (Fase 7.3). No bloquea el pago si falla.
  let quien = "";
  if (input.miembro_id) {
    const { data: m } = await supabase
      .from("miembros")
      .select("nombre")
      .eq("tenant_id", tenantId)
      .eq("id", input.miembro_id)
      .maybeSingle();
    if (m?.nombre) quien = ` de ${m.nombre}`;
  }
  await createNotification(
    tenantId,
    "pago",
    `Pago registrado: $${input.monto.toLocaleString("es-MX")}${quien}`,
    undefined,
    "caja"
  );

  // WhatsApp (Fase 7.5): PAGO_REGISTRADO al miembro. Fire-and-forget, gateado
  // y no-op si la infra está dormida. No aplica a visitas rápidas (sin miembro).
  if (input.miembro_id) {
    const domain = process.env.APP_DOMAIN ?? "app.gym.stringwebs.com";
    void emitPagoRegistrado({
      tenantId,
      miembroId: input.miembro_id,
      monto: input.monto,
      planId: input.plan_id || null,
      fechaVencimiento: input.periodo_fin || null,
      reciboUrl: `https://${domain}/recibos/${token}`,
    });
  }

  // Recibo por email — centralizado aquí (Bloque 5): antes solo lo mandaba
  // el cobro rápido de caja, a mano, después de llamar a createPago. Ticket,
  // renovar, cuota y el webhook de MercadoPago se quedaban sin recibo.
  let reciboEnviado: boolean | undefined;
  let reciboError: string | undefined;
  if (input.miembro_id) {
    const recibo = await enviarReciboDePago(tenantId, {
      miembroId: input.miembro_id,
      monto: input.monto,
      token,
      periodoFin: input.periodo_fin || null,
    });
    reciboEnviado = recibo.enviado;
    reciboError = recibo.error;
  }

  return { ok: true, id: data.id, token, reciboEnviado, reciboError };
}

/**
 * Envía el recibo por email del pago recién registrado. Centraliza lo que
 * antes hacía a mano `registerPagoAction` (caja): resolver el email del
 * socio, los datos del gym/marca, y armar la URL del recibo público. No
 * lanza y no revierte nada si falla — el cobro ya es real — pero SÍ deja
 * rastro (log) y devuelve el resultado para que el caller pueda avisar en
 * la UI si quiere (toast "warning": el cobro salió bien, el correo no).
 *
 * `client` opcional para contextos sin sesión (el webhook de MercadoPago
 * usa el admin client — mismo patrón que registrarCajaDePagos).
 */
export async function enviarReciboDePago(
  tenantId: string,
  params: {
    miembroId: string;
    monto: number;
    token: string;
    periodoFin?: string | null;
  },
  client?: SupabaseClient
): Promise<{ enviado: boolean; error?: string }> {
  const supabase = client ?? (await createClient());

  const [{ data: miembro }, { data: gym }] = await Promise.all([
    supabase
      .from("miembros")
      .select("nombre, email")
      .eq("tenant_id", tenantId)
      .eq("id", params.miembroId)
      .maybeSingle(),
    supabase
      .from("gyms")
      .select("nombre, telefono, direccion, logo_url, plan, color_acento")
      .eq("id", tenantId)
      .maybeSingle(),
  ]);

  // Sin email en el socio no hay a dónde mandarlo — no es un fallo, es que
  // no aplica (igual que antes: "Capa 1: email con link, solo si tiene email").
  if (!miembro?.email || !gym) return { enviado: false };

  const domain = process.env.APP_DOMAIN ?? "app.gym.stringwebs.com";
  const reciboUrl = `https://${domain}/recibos/${params.token}`;
  const colorAcento = hasFeature(gym.plan as Plan, "color_gimnasio")
    ? (gym.color_acento as string | null) ?? undefined
    : undefined;

  const r = await sendRecibo({
    miembroEmail: miembro.email as string,
    miembroNombre: miembro.nombre as string,
    gymNombre: (gym.nombre as string | null) ?? "",
    gymTelefono: gym.telefono as string | null,
    gymDireccion: gym.direccion as string | null,
    logoUrl: gym.logo_url as string | null,
    colorAcento,
    monto: params.monto,
    fechaVencimiento: params.periodoFin ?? null,
    reciboUrl,
  });

  if (!r.ok) {
    logError("recibo.envio_fallido", {
      tenantId,
      miembroId: params.miembroId,
      error: r.error,
    });
    return { enviado: false, error: r.error };
  }
  return { enviado: true };
}

export interface TicketLinea {
  id: string;
  concepto: string;
  monto: number;
  producto_nombre: string | null;
  plan_nombre: string | null;
}

export interface TicketCompleto {
  ticket_id: string;
  fecha_pago: string;
  metodo_pago: string | null;
  miembro_nombre: string | null;
  total: number;
  lineas: TicketLinea[];
  gym_nombre: string;
  gym_logo_url: string | null;
}

/** Todas las líneas de un ticket agrupadas, para el recibo. */
export async function getTicketCompleto(
  tenantId: string,
  ticketId: string
): Promise<TicketCompleto | null> {
  const supabase = await createClient();
  const [pagosRes, gymRes] = await Promise.all([
    supabase
      .from("pagos")
      .select(
        "id, concepto, monto, metodo_pago, fecha_pago, miembros(nombre), productos(nombre), planes_membresia(nombre)"
      )
      .eq("tenant_id", tenantId)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    supabase.from("gyms").select("nombre, logo_url").eq("id", tenantId).single(),
  ]);

  const rows = pagosRes.data ?? [];
  if (rows.length === 0) return null;

  const embedNombre = (v: unknown): string | null => {
    if (!v) return null;
    const o = Array.isArray(v) ? v[0] : v;
    return (o as { nombre?: string })?.nombre ?? null;
  };

  const lineas: TicketLinea[] = rows.map((r) => ({
    id: r.id as string,
    concepto: r.concepto as string,
    monto: Number(r.monto),
    producto_nombre: embedNombre(r.productos),
    plan_nombre: embedNombre(r.planes_membresia),
  }));

  const first = rows[0];
  const gym = gymRes.data as { nombre?: string; logo_url?: string | null } | null;

  return {
    ticket_id: ticketId,
    fecha_pago: first.fecha_pago as string,
    metodo_pago: (first.metodo_pago as string | null) ?? null,
    miembro_nombre: embedNombre(first.miembros),
    total: lineas.reduce((s, l) => s + l.monto, 0),
    lineas,
    gym_nombre: gym?.nombre ?? "",
    gym_logo_url: gym?.logo_url ?? null,
  };
}

export interface TicketItemInput {
  tipo: "producto" | "membresia";
  producto_id?: string;
  cantidad?: number;
  plan_id?: string;
  monto: number;
  periodo_inicio?: string;
  periodo_fin?: string;
}

/**
 * Registra un ticket multi-línea (B4) de forma atómica vía RPC. Cada línea es
 * un pago con el mismo ticket_id; el token público va en la primera línea. Los
 * montos/periodos ya vienen calculados y validados server-side por el action.
 */
export async function registrarTicket(
  tenantId: string,
  input: {
    metodo: "efectivo" | "tarjeta" | "transferencia";
    miembroId: string | null;
    items: TicketItemInput[];
  }
): Promise<
  | {
      ok: true;
      ticketId: string;
      token: string;
      reciboEnviado?: boolean;
      reciboError?: string;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const token = generarTokenRecibo();

  const { data, error } = await supabase.rpc("registrar_ticket", {
    p_tenant_id: tenantId,
    p_metodo_pago: input.metodo,
    p_token: token,
    p_miembro_id: input.miembroId,
    p_items: input.items,
  });

  if (error || !data) {
    const msg = error?.message ?? "";
    if (msg.includes("STOCK_INSUFICIENTE")) {
      return { ok: false, error: "Stock insuficiente para completar el ticket." };
    }
    if (msg.includes("INVENTARIO_NO_ENCONTRADO")) {
      return { ok: false, error: "No se encontró el inventario de un producto." };
    }
    return { ok: false, error: msg || "No se pudo registrar el ticket." };
  }

  const ticketId = data as string;

  // El RPC crea una fila en `pagos` por línea, todas con el mismo ticket_id.
  // Cada línea resuelve su propia caja por su producto (un ticket puede
  // mezclar, ej., un agua y una membresía — cada una a su caja).
  const { data: lineas } = await supabase
    .from("pagos")
    .select("id, producto_id")
    .eq("tenant_id", tenantId)
    .eq("ticket_id", ticketId);

  await Promise.all(
    (lineas ?? []).map(async (l) => {
      const caja = await resolverCajaDeVenta(
        tenantId,
        (l.producto_id as string | null) ?? null
      );
      await registrarCajaDePagos(supabase, tenantId, [l.id as string], caja ?? undefined);
    })
  );

  // Recibo por email del ticket completo — antes solo lo mandaba el cobro
  // rápido; un ticket con membresía + productos se quedaba sin recibo.
  let reciboEnviado: boolean | undefined;
  let reciboError: string | undefined;
  if (input.miembroId) {
    const total = input.items.reduce((s, it) => s + it.monto, 0);
    const lineaMembresia = input.items.find((it) => it.tipo === "membresia");
    const recibo = await enviarReciboDePago(tenantId, {
      miembroId: input.miembroId,
      monto: total,
      token,
      periodoFin: lineaMembresia?.periodo_fin ?? null,
    });
    reciboEnviado = recibo.enviado;
    reciboError = recibo.error;
  }

  return { ok: true, ticketId, token, reciboEnviado, reciboError };
}

/**
 * Registra una visita rápida: un pago de concepto 'visita' sin miembro,
 * con los datos del visitante. No crea miembro ni prospecto.
 */
export async function createVisitaRapida(
  tenantId: string,
  input: VisitaRapidaInput,
  cajaId?: string
): Promise<
  { ok: true; id: string; token: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const token = generarTokenRecibo();

  const { data, error } = await supabase
    .from("pagos")
    .insert({
      tenant_id: tenantId,
      miembro_id: null,
      concepto: "visita",
      monto: input.monto,
      metodo_pago: input.metodo_pago,
      es_visita_rapida: true,
      nombre_visitante: input.nombre_visitante,
      telefono_visitante: input.telefono_visitante || null,
      token_publico: token,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo registrar la visita" };
  }
  await registrarCajaDePagos(supabase, tenantId, [data.id], cajaId);
  return { ok: true, id: data.id, token };
}

/**
 * Marca un pago como anulado (no cuenta en totales; recibo público → 410).
 * Si era venta de producto, repone el stock — vía RPC (sql/066), con la
 * misma atomicidad (lock de fila + una transacción) con la que
 * registrar_pago lo descuenta al cobrar.
 */
export async function anularPago(
  tenantId: string,
  pagoId: string,
  motivo?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: pago } = await supabase
    .from("pagos")
    .select("miembro_id, concepto, periodo_inicio, periodo_fin")
    .eq("tenant_id", tenantId)
    .eq("id", pagoId)
    .maybeSingle();

  const { error } = await supabase.rpc("anular_pago", {
    p_tenant_id: tenantId,
    p_pago_id: pagoId,
    p_motivo: motivo ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("PAGO_NO_ENCONTRADO")) {
      return { ok: false, error: "Pago no encontrado." };
    }
    if (msg.includes("YA_ANULADO")) {
      return { ok: false, error: "Este pago ya estaba anulado." };
    }
    return { ok: false, error: msg || "No se pudo anular el pago." };
  }

  // Si el pago extendió la membresía (concepto membresía, con periodo) y esa
  // extensión sigue vigente (nadie renovó después), se revierte: el
  // vencimiento vuelve a un día antes de que este pago empezara a contar.
  // Si ya hubo un pago posterior, fecha_vencimiento no coincide con este
  // periodo_fin y no se toca (sería revertir la extensión equivocada).
  if (pago?.miembro_id && pago.concepto === "membresia" && pago.periodo_fin) {
    const { data: miembro } = await supabase
      .from("miembros")
      .select("fecha_vencimiento")
      .eq("tenant_id", tenantId)
      .eq("id", pago.miembro_id as string)
      .maybeSingle();

    if (miembro?.fecha_vencimiento === pago.periodo_fin) {
      const vencimientoPrevio = pago.periodo_inicio
        ? isoMasDias(-1, pago.periodo_inicio as string)
        : null;
      const { error: revertErr } = await supabase
        .from("miembros")
        .update({ fecha_vencimiento: vencimientoPrevio })
        .eq("tenant_id", tenantId)
        .eq("id", pago.miembro_id as string);
      // El pago ya se anuló (RPC arriba); si esto falla el socio se queda
      // con la vigencia extendida por un pago que ya no cuenta como
      // ingreso — antes nadie se enteraba.
      if (revertErr) {
        logError("pago.anular_revertir_vigencia_fallo", {
          tenantId,
          pagoId,
          miembroId: pago.miembro_id,
          error: revertErr.message,
        });
      }
    }
  }

  // Si el pago cubría una cuota de crédito, desmarcarla (Bug #6): de lo
  // contrario Cuentas por Cobrar la seguiría mostrando pagada aunque el dinero
  // se revirtió.
  const { data: cuota } = await supabase
    .from("cuotas_pago")
    .select("id, plan_id")
    .eq("tenant_id", tenantId)
    .eq("pago_id", pagoId)
    .maybeSingle();

  if (cuota) {
    const { error: cuotaErr } = await supabase
      .from("cuotas_pago")
      .update({ pagado_at: null, pago_id: null })
      .eq("tenant_id", tenantId)
      .eq("id", cuota.id as string);
    if (cuotaErr) {
      return {
        ok: false,
        error:
          "El pago se anuló, pero no se pudo revertir la cuota de crédito. Reinténtalo.",
      };
    }

    // Si el plan estaba completado, vuelve a tener una cuota pendiente.
    const { error: reabrirErr } = await supabase
      .from("planes_pago")
      .update({ estado: "activo" })
      .eq("tenant_id", tenantId)
      .eq("id", cuota.plan_id as string)
      .eq("estado", "completado");
    if (reabrirErr) {
      logError("pago.anular_reabrir_plan_pago_fallo", {
        tenantId,
        pagoId,
        planPagoId: cuota.plan_id,
        error: reabrirErr.message,
      });
    }
  }

  return { ok: true };
}

const VENTANA_PAGO_RECIENTE_MIN = 5;

/**
 * ¿Este socio ya tiene un pago de membresía válido en los últimos
 * VENTANA_PAGO_RECIENTE_MIN minutos? Aviso de posible doble cobro: dos
 * pestañas de caja cobrando al mismo socio casi a la vez generaban dos pagos
 * con una sola extensión de vigencia. No bloquea — el caller decide si avisa
 * y deja confirmar.
 */
export async function pagoMembresiaReciente(
  tenantId: string,
  miembroId: string
): Promise<boolean> {
  const supabase = await createClient();
  const desde = new Date(
    Date.now() - VENTANA_PAGO_RECIENTE_MIN * 60_000
  ).toISOString();
  const { count } = await supabase
    .from("pagos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("concepto", "membresia")
    .is("anulado_at", null)
    .gte("created_at", desde);
  return (count ?? 0) > 0;
}

export async function countVisitasRapidasHoy(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const inicioHoy = hoyCDMX();

  const { count, error } = await supabase
    .from("pagos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("es_visita_rapida", true)
    .gte("fecha_pago", inicioHoy.toISOString());

  if (error) return 0;
  return count ?? 0;
}

/**
 * Convierte categoría de UI a array de conceptos de DB.
 */
function categoriaAConceptos(cat: CategoriaCaja): string[] | null {
  if (cat === "all") return null;
  if (cat === "membresia") return ["membresia", "visita"];
  if (cat === "producto") return ["producto"];
  if (cat === "otros") return ["otro"];
  return null; // "visitas" se filtra por es_visita_rapida, no por concepto
}

/**
 * Lista pagos del día (filtrable por categoría) con miembro embebido. Con
 * turno abierto, `desde` debe ser `corte.abierto_at`: si el turno cruzó
 * medianoche, la lista debe empezar donde empiezan los totales del turno
 * (resumenCorteEnVivo ya usa abierto_at) — si no, "Movimientos del turno" y
 * los totales del turno no coinciden. Sin turno, cae a medianoche de México.
 */
export async function listPagosDelDia(
  tenantId: string,
  categoria: CategoriaCaja = "all",
  limit = 50,
  cajaId?: string,
  desde?: string
): Promise<PagoConMiembro[]> {
  const supabase = await createClient();

  const inicioHoy = desde ?? hoyCDMX().toISOString();

  let q = supabase
    .from("pagos")
    .select(
      "id, tenant_id, miembro_id, concepto, monto, metodo_pago, fecha_pago, periodo_inicio, periodo_fin, plan_id, promocion_id, producto_id, folio, es_visita_rapida, nombre_visitante, telefono_visitante, token_publico, anulado_at, reembolsado_at, reembolsado_motivo, ticket_id, created_at, miembros(nombre)"
    )
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicioHoy)
    .order("fecha_pago", { ascending: false })
    // Se filtra por caja después de traer (pagos_caja es una tabla aparte),
    // así que se pide de más para no truncar antes de filtrar.
    .limit(cajaId ? limit * 3 : limit);

  if (categoria === "visitas") {
    q = q.eq("es_visita_rapida", true);
  } else {
    const conceptos = categoriaAConceptos(categoria);
    if (conceptos) q = q.in("concepto", conceptos);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  const filtrados = (await filtrarPorCaja(supabase, tenantId, cajaId, data)).slice(
    0,
    limit
  );

  return filtrados.map((row: any) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    miembro_id: row.miembro_id,
    concepto: row.concepto,
    monto: Number(row.monto),
    metodo_pago: row.metodo_pago,
    fecha_pago: row.fecha_pago,
    periodo_inicio: row.periodo_inicio,
    periodo_fin: row.periodo_fin,
    plan_id: row.plan_id,
    promocion_id: row.promocion_id,
    producto_id: row.producto_id,
    folio: row.folio ?? null,
    es_visita_rapida: Boolean(row.es_visita_rapida),
    nombre_visitante: row.nombre_visitante ?? null,
    telefono_visitante: row.telefono_visitante ?? null,
    token_publico: row.token_publico ?? null,
    anulado_at: row.anulado_at ?? null,
    reembolsado_at: row.reembolsado_at ?? null,
    reembolsado_motivo: row.reembolsado_motivo ?? null,
    ticket_id: row.ticket_id ?? null,
    created_at: row.created_at,
    miembro_nombre: row.miembros?.nombre ?? null,
  }));
}

/** Acota `rows` (cada uno con `id`) a los que pertenecen a `cajaId`. Sin
 * cajaId, devuelve todo tal cual (comportamiento de antes de que existieran
 * las cajas múltiples). */
async function filtrarPorCaja<T extends { id: string }>(
  supabase: SupabaseClient,
  tenantId: string,
  cajaId: string | undefined,
  rows: T[]
): Promise<T[]> {
  if (!cajaId || rows.length === 0) return rows;
  const { data } = await supabase
    .from("pagos_caja")
    .select("pago_id")
    .eq("tenant_id", tenantId)
    .eq("caja_id", cajaId)
    .in(
      "pago_id",
      rows.map((r) => r.id)
    );
  const ids = new Set((data ?? []).map((r) => r.pago_id as string));
  return rows.filter((r) => ids.has(r.id));
}

export interface ResumenPeriodo {
  total: number;
  cantidad: number;
}

export interface ResumenCaja {
  dia: ResumenPeriodo;
  semana: ResumenPeriodo;
  mes: ResumenPeriodo;
}

/**
 * Calcula totales día/semana/mes para la categoría seleccionada.
 * Una sola query (rango mensual) y se subdividen en memoria.
 */
export async function getResumenCaja(
  tenantId: string,
  categoria: CategoriaCaja = "all",
  cajaId?: string
): Promise<ResumenCaja> {
  const supabase = await createClient();

  const inicioMes = inicioDeMesCDMX();
  const inicioDia = hoyCDMX();

  // Semana: lunes 00:00 de esta semana (en México). El día de la semana se
  // toma del YMD de hoy en México; México no tiene DST, así que restar días
  // en ms es exacto.
  const dow = new Date(hoyISO() + "T00:00:00Z").getUTCDay(); // 0=domingo
  const diasARestar = dow === 0 ? 6 : dow - 1;
  const inicioSemana = new Date(inicioDia.getTime() - diasARestar * 86400000);

  let q = supabase
    .from("pagos")
    .select("id, monto, fecha_pago, concepto")
    .eq("tenant_id", tenantId)
    .is("anulado_at", null) // los pagos anulados no cuentan en totales
    .is("reembolsado_at", null) // ni los reembolsados
    .gte("fecha_pago", inicioMes.toISOString());

  if (categoria === "visitas") {
    q = q.eq("es_visita_rapida", true);
  } else {
    const conceptos = categoriaAConceptos(categoria);
    if (conceptos) q = q.in("concepto", conceptos);
  }

  const { data: dataCruda, error } = await q;

  const empty: ResumenPeriodo = { total: 0, cantidad: 0 };
  const resumen: ResumenCaja = {
    dia: { ...empty },
    semana: { ...empty },
    mes: { ...empty },
  };

  if (error || !dataCruda) return resumen;

  const data = await filtrarPorCaja(supabase, tenantId, cajaId, dataCruda);

  for (const p of data) {
    const monto = Number(p.monto);
    const fecha = new Date(p.fecha_pago);

    resumen.mes.total += monto;
    resumen.mes.cantidad += 1;

    if (fecha >= inicioSemana) {
      resumen.semana.total += monto;
      resumen.semana.cantidad += 1;
    }
    if (fecha >= inicioDia) {
      resumen.dia.total += monto;
      resumen.dia.cantidad += 1;
    }
  }

  return resumen;
}

export async function getPagoCompleto(
  tenantId: string,
  pagoId: string
): Promise<PagoCompleto | null> {
  const supabase = await createClient();

  const [pagoRes, gymRes] = await Promise.all([
    supabase
      .from("pagos")
      .select("*, miembros(nombre, telefono)")
      .eq("tenant_id", tenantId)
      .eq("id", pagoId)
      .single(),
    supabase
      .from("gyms")
      .select("nombre, telefono, direccion, rfc, logo_url")
      .eq("id", tenantId)
      .single(),
  ]);

  if (pagoRes.error || !pagoRes.data) return null;
  const row = pagoRes.data as any;
  const gym = gymRes.data as any;

  return {
    ...row,
    monto: Number(row.monto),
    folio: row.folio ?? null,
    miembro_nombre: row.miembros?.nombre ?? null,
    miembro_telefono: row.miembros?.telefono ?? null,
    gym_nombre: gym?.nombre ?? "",
    gym_telefono: gym?.telefono ?? null,
    gym_direccion: gym?.direccion ?? null,
    gym_rfc: gym?.rfc ?? null,
    gym_logo_url: gym?.logo_url ?? null,
  };
}

/**
 * Lookup de recibo por token público (ruta pública sin login). Usa el client
 * admin porque no hay sesión ni tenant en contexto.
 */
export async function getPagoCompletoByToken(
  token: string
): Promise<PagoCompleto | null> {
  const admin = createAdminClient();

  const { data: pago } = await admin
    .from("pagos")
    .select("*, miembros(nombre, telefono)")
    .eq("token_publico", token)
    .maybeSingle();

  if (!pago) return null;
  const row = pago as any;

  const { data: gym } = await admin
    .from("gyms")
    .select("nombre, telefono, direccion, rfc, logo_url")
    .eq("id", row.tenant_id)
    .single();

  return {
    ...row,
    monto: Number(row.monto),
    folio: row.folio ?? null,
    es_visita_rapida: Boolean(row.es_visita_rapida),
    nombre_visitante: row.nombre_visitante ?? null,
    telefono_visitante: row.telefono_visitante ?? null,
    token_publico: row.token_publico ?? null,
    anulado_at: row.anulado_at ?? null,
    // Para visitas el "cliente" es el visitante.
    miembro_nombre: row.miembros?.nombre ?? row.nombre_visitante ?? null,
    miembro_telefono: row.miembros?.telefono ?? row.telefono_visitante ?? null,
    gym_nombre: gym?.nombre ?? "",
    gym_telefono: gym?.telefono ?? null,
    gym_direccion: gym?.direccion ?? null,
    gym_rfc: gym?.rfc ?? null,
    gym_logo_url: gym?.logo_url ?? null,
  };
}

/**
 * Historial de pagos de un miembro.
 */
export async function listPagosByMiembro(
  tenantId: string,
  miembroId: string,
  limit = 30
): Promise<Pago[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("fecha_pago", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((p) => ({ ...p, monto: Number(p.monto) }));
}
