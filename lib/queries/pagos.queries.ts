import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PagoInput } from "@/lib/validations/pago.schema";
import type { VisitaRapidaInput } from "@/lib/validations/visita-rapida.schema";
import { generarTokenRecibo } from "@/lib/utils/tokens";
import { aplicarMovimiento } from "@/lib/queries/productos.queries";
import { createNotification } from "@/lib/utils/notifications";
import { hoyCDMX, hoyISO, inicioDeMesCDMX } from "@/lib/utils/dates";
import { emitPagoRegistrado } from "@/lib/whatsapp/emit";

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
  input: PagoInput
): Promise<
  { ok: true; id: string; token: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const token = generarTokenRecibo();

  const payload = {
    tenant_id: tenantId,
    miembro_id: input.miembro_id || null,
    concepto: input.concepto,
    monto: input.monto,
    metodo_pago: input.metodo_pago,
    periodo_inicio: input.periodo_inicio || null,
    periodo_fin: input.periodo_fin || null,
    plan_id: input.plan_id || null,
    promocion_id: input.promocion_id || null,
    producto_id: input.producto_id || null,
    token_publico: token,
  };

  const { data, error } = await supabase
    .from("pagos")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo registrar el pago",
    };
  }

  // Si es venta de producto, descontar del stock con un movimiento de salida.
  if (input.concepto === "producto" && input.producto_id) {
    const cantidad = input.cantidad_producto ?? 1;
    const movResult = await aplicarMovimiento(
      tenantId,
      {
        producto_id: input.producto_id,
        tipo: "salida",
        cantidad,
        motivo: "Venta en caja",
      },
      data.id
    );

    if (!movResult.ok) {
      return {
        ok: false,
        error:
          "El pago se registró, pero hubo un problema con el stock: " +
          movResult.error,
      };
    }
  }

  // Si es pago de membresía, actualizar fecha_vencimiento del miembro (y su
  // plan, para que la ficha refleje el plan vigente y las renovaciones lo
  // reutilicen). Solo pisamos plan_id si el cobro trae uno.
  if (input.concepto === "membresia" && input.miembro_id && input.periodo_fin) {
    const updatePayload: Record<string, string> = {
      fecha_vencimiento: input.periodo_fin,
      estado: "activo",
    };
    if (input.plan_id) updatePayload.plan_id = input.plan_id;

    const { error: updError } = await supabase
      .from("miembros")
      .update(updatePayload)
      .eq("tenant_id", tenantId)
      .eq("id", input.miembro_id);

    if (updError) {
      return {
        ok: false,
        error:
          "El pago se registró, pero no se pudo actualizar la fecha de vencimiento. Revísalo en el detalle del miembro.",
      };
    }
  }

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

  return { ok: true, id: data.id, token };
}

/**
 * Registra una visita rápida: un pago de concepto 'visita' sin miembro,
 * con los datos del visitante. No crea miembro ni prospecto.
 */
export async function createVisitaRapida(
  tenantId: string,
  input: VisitaRapidaInput
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
  return { ok: true, id: data.id, token };
}

/** Marca un pago como anulado (no cuenta en totales; recibo público → 410). */
export async function anularPago(
  tenantId: string,
  pagoId: string,
  motivo?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagos")
    .update({ anulado_at: new Date().toISOString(), anulado_motivo: motivo ?? null })
    .eq("tenant_id", tenantId)
    .eq("id", pagoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
 * Lista pagos del día (filtrable por categoría) con miembro embebido.
 */
export async function listPagosDelDia(
  tenantId: string,
  categoria: CategoriaCaja = "all",
  limit = 50
): Promise<PagoConMiembro[]> {
  const supabase = await createClient();

  const inicioHoy = hoyCDMX();

  let q = supabase
    .from("pagos")
    .select(
      "id, tenant_id, miembro_id, concepto, monto, metodo_pago, fecha_pago, periodo_inicio, periodo_fin, plan_id, promocion_id, producto_id, folio, es_visita_rapida, nombre_visitante, telefono_visitante, token_publico, anulado_at, created_at, miembros(nombre)"
    )
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicioHoy.toISOString())
    .order("fecha_pago", { ascending: false })
    .limit(limit);

  if (categoria === "visitas") {
    q = q.eq("es_visita_rapida", true);
  } else {
    const conceptos = categoriaAConceptos(categoria);
    if (conceptos) q = q.in("concepto", conceptos);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row: any) => ({
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
    created_at: row.created_at,
    miembro_nombre: row.miembros?.nombre ?? null,
  }));
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
  categoria: CategoriaCaja = "all"
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
    .select("monto, fecha_pago, concepto")
    .eq("tenant_id", tenantId)
    .is("anulado_at", null) // los pagos anulados no cuentan en totales
    .gte("fecha_pago", inicioMes.toISOString());

  if (categoria === "visitas") {
    q = q.eq("es_visita_rapida", true);
  } else {
    const conceptos = categoriaAConceptos(categoria);
    if (conceptos) q = q.in("concepto", conceptos);
  }

  const { data, error } = await q;

  const empty: ResumenPeriodo = { total: 0, cantidad: 0 };
  const resumen: ResumenCaja = {
    dia: { ...empty },
    semana: { ...empty },
    mes: { ...empty },
  };

  if (error || !data) return resumen;

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
