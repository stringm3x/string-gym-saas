/**
 * Corte de caja / arqueo por turno (B1). Un turno se abre con un fondo inicial
 * en efectivo y al cerrar se cuadra el efectivo contado contra el esperado
 * (fondo + efectivo cobrado durante el turno).
 *
 * Cada turno pertenece a una caja (ver lib/queries/cajas.queries.ts) — puede
 * haber varias cajas abiertas al mismo tiempo (Recepción, Aguas…), cada una
 * con su propio fondo y su propio cuadre. Como dos turnos pueden solaparse en
 * el tiempo, un rango de fechas por sí solo no basta para saber qué pagos son
 * de cuál caja: se cruza contra `pagos_caja` (el enlace pago→caja que se
 * llena en TypeScript justo después de cada cobro, sin tocar el RPC que
 * inserta en `pagos`). Ver sql/063_cajas_multiples.sql.
 */
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CorteAbierto {
  id: string;
  caja_id: string;
  fondo_inicial: number;
  abierto_por_nombre: string | null;
  abierto_at: string;
}

export interface CorteTotales {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  total: number;
  cantidad: number;
  /** Reembolsos en efectivo del turno (salen del cajón). */
  reembolsosEfectivo: number;
}

export interface ConceptoTotal {
  cantidad: number;
  total: number;
}

export interface CorteTotalesPorConcepto {
  membresia: ConceptoTotal;
  visita: ConceptoTotal;
  producto: ConceptoTotal;
  otro: ConceptoTotal;
  /** Venta de productos − costo (ver costoProductosVendidosEnRango). */
  gananciaProductos: number;
}

export interface CorteHistorial {
  id: string;
  caja_id: string;
  estado: "abierto" | "cerrado";
  fondo_inicial: number;
  abierto_por_nombre: string | null;
  abierto_at: string;
  cerrado_por_nombre: string | null;
  cerrado_at: string | null;
  total_efectivo: number | null;
  total_tarjeta: number | null;
  total_transferencia: number | null;
  efectivo_esperado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  notas: string | null;
  total_membresia: number | null;
  total_visita: number | null;
  total_producto: number | null;
  total_otro: number | null;
  ganancia_productos: number | null;
}

/** El turno abierto de una caja específica, o null si no tiene uno. */
export async function getCorteAbierto(
  tenantId: string,
  cajaId: string
): Promise<CorteAbierto | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cortes_caja")
    .select("id, caja_id, fondo_inicial, abierto_por_nombre, abierto_at")
    .eq("tenant_id", tenantId)
    .eq("caja_id", cajaId)
    .eq("estado", "abierto")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    caja_id: data.caja_id as string,
    fondo_inicial: Number(data.fondo_inicial),
    abierto_por_nombre: (data.abierto_por_nombre as string | null) ?? null,
    abierto_at: data.abierto_at as string,
  };
}

export interface CajaAbiertaResumen {
  cajaId: string;
  corteId: string;
  totalCobrado: number;
}

/** Todos los turnos abiertos del gym ahora mismo, con su total en vivo — para
 * la vista consolidada del dueño ("Recepción $2,400 · Aguas $180"). */
export async function listCajasAbiertas(
  tenantId: string
): Promise<CajaAbiertaResumen[]> {
  const supabase = await createClient();
  const { data: cortes } = await supabase
    .from("cortes_caja")
    .select("id, caja_id, abierto_at")
    .eq("tenant_id", tenantId)
    .eq("estado", "abierto");
  if (!cortes?.length) return [];

  const ahora = new Date().toISOString();
  const resultados = await Promise.all(
    cortes.map(async (c) => {
      const t = await totalesEnRango(
        supabase,
        tenantId,
        c.caja_id as string,
        c.abierto_at as string,
        ahora
      );
      return {
        cajaId: c.caja_id as string,
        corteId: c.id as string,
        totalCobrado: t.total,
      };
    })
  );
  return resultados;
}

/** IDs, de entre `pagoIds`, que pertenecen a `cajaId`. */
async function pagoIdsEnCaja(
  supabase: SupabaseClient,
  tenantId: string,
  cajaId: string,
  pagoIds: string[]
): Promise<Set<string>> {
  if (pagoIds.length === 0) return new Set();
  const { data } = await supabase
    .from("pagos_caja")
    .select("pago_id")
    .eq("tenant_id", tenantId)
    .eq("caja_id", cajaId)
    .in("pago_id", pagoIds);
  return new Set((data ?? []).map((r) => r.pago_id as string));
}

/**
 * Suma de pagos no anulados de una caja, por método, en [desde, hasta).
 *
 * Efectivo cuenta bruto (se cobró y entró al cajón este turno), incluso si
 * después se reembolsa: la salida de efectivo se descuenta aparte, abajo, vía
 * `reembolsosEfectivo` (que puede caer en OTRO turno distinto al de la venta
 * original — lo que importa para el cuadre físico es cuándo salió el
 * efectivo, no cuándo se vendió). Tarjeta y transferencia no tienen ese
 * mecanismo de salida física — no hay "cajón" que cuadrar — así que un pago
 * ya reembolsado por esos medios se excluye directamente de una vez, igual
 * que ya hace "Cobrado hoy" (getResumenCaja en pagos.queries.ts). Antes esto
 * no se filtraba y un reembolso con tarjeta dejaba el corte contando una
 * venta que ya se devolvió.
 */
async function totalesEnRango(
  supabase: SupabaseClient,
  tenantId: string,
  cajaId: string,
  desde: string,
  hasta: string
): Promise<CorteTotales> {
  const { data } = await supabase
    .from("pagos")
    .select("id, monto, metodo_pago, reembolsado_at")
    .eq("tenant_id", tenantId)
    .is("anulado_at", null)
    .gte("fecha_pago", desde)
    .lt("fecha_pago", hasta);

  const candidatos = data ?? [];
  const idsDeEstaCaja = await pagoIdsEnCaja(
    supabase,
    tenantId,
    cajaId,
    candidatos.map((p) => p.id as string)
  );

  const t: CorteTotales = {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0,
    cantidad: 0,
    reembolsosEfectivo: 0,
  };
  for (const p of candidatos) {
    if (!idsDeEstaCaja.has(p.id as string)) continue;
    const esEfectivo = p.metodo_pago === "efectivo";
    if (!esEfectivo && p.reembolsado_at) continue;
    const m = Number(p.monto);
    t.total += m;
    t.cantidad += 1;
    if (esEfectivo) t.efectivo += m;
    else if (p.metodo_pago === "tarjeta") t.tarjeta += m;
    else if (p.metodo_pago === "transferencia") t.transferencia += m;
  }

  // Reembolsos en efectivo del turno: salen del cajón. Se acotan a esta caja
  // vía el pago original que reembolsan (reembolsos no tiene caja_id propio).
  const { data: reemb } = await supabase
    .from("reembolsos")
    .select("pago_id, monto")
    .eq("tenant_id", tenantId)
    .eq("tipo", "efectivo")
    .gte("created_at", desde)
    .lt("created_at", hasta);
  const reembCandidatos = reemb ?? [];
  const reembIdsEnCaja = await pagoIdsEnCaja(
    supabase,
    tenantId,
    cajaId,
    reembCandidatos.map((r) => r.pago_id as string)
  );
  t.reembolsosEfectivo = reembCandidatos
    .filter((r) => reembIdsEnCaja.has(r.pago_id as string))
    .reduce((s, r) => s + Number(r.monto), 0);

  return t;
}

/** Totales del turno en curso de una caja, hasta ahora. */
export async function resumenCorteEnVivo(
  tenantId: string,
  cajaId: string,
  desde: string
): Promise<CorteTotales> {
  const supabase = await createClient();
  return totalesEnRango(
    supabase,
    tenantId,
    cajaId,
    desde,
    new Date().toISOString()
  );
}

/**
 * Costo (COGS) de productos vendidos de una caja en [desde, hasta) — dos
 * fuentes:
 *  - Venta directa en caja: movimientos de salida ligados (pago_id) a un
 *    pago válido (no anulado, de esta caja) cuya fecha_pago cae en el rango.
 *  - Venta a crédito (plan a plazos): el pago real llega después en cuotas
 *    separadas sin producto_id, así que su costo se reconoce cuando el
 *    stock realmente salió (plan_pago_id, fecha del movimiento) — no
 *    cuando se cobra cada cuota. Los planes a plazos no tienen un punto de
 *    venta físico, así que solo cuentan para la caja default (ver
 *    createPlanPago en creditos.queries.ts, que no pasa cajaId al RPC —
 *    cae en pagos_caja vía la caja default como cualquier pago sin caja
 *    explícita). Ver sql/061_ganancia_productos.sql.
 */
async function costoProductosVendidosEnRango(
  supabase: SupabaseClient,
  tenantId: string,
  cajaId: string,
  desde: string,
  hasta: string
): Promise<number> {
  const { data: pagosValidos } = await supabase
    .from("pagos")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("concepto", "producto")
    .is("anulado_at", null)
    .gte("fecha_pago", desde)
    .lt("fecha_pago", hasta);
  const candidatos = (pagosValidos ?? []).map((p) => p.id as string);
  const idsEnCaja = await pagoIdsEnCaja(supabase, tenantId, cajaId, candidatos);
  const pagoIds = candidatos.filter((id) => idsEnCaja.has(id));

  const [directos, credito] = await Promise.all([
    pagoIds.length
      ? supabase
          .from("movimientos_inventario")
          .select("cantidad, producto_id")
          .eq("tenant_id", tenantId)
          .eq("tipo", "salida")
          .in("pago_id", pagoIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    // Ventas a crédito: sin punto de venta físico → solo cuentan para la
    // caja default (ver nota del docstring).
    isCajaDefault(supabase, tenantId, cajaId).then((esDefault) =>
      esDefault
        ? supabase
            .from("movimientos_inventario")
            .select("cantidad, producto_id")
            .eq("tenant_id", tenantId)
            .eq("tipo", "salida")
            .not("plan_pago_id", "is", null)
            .gte("created_at", desde)
            .lt("created_at", hasta)
            .then((r) => r.data ?? [])
        : []
    ),
  ]);

  const filas = [...directos, ...credito];
  if (filas.length === 0) return 0;

  const productoIds = [...new Set(filas.map((f) => f.producto_id as string))];
  const { data: productos } = await supabase
    .from("productos")
    .select("id, costo")
    .eq("tenant_id", tenantId)
    .in("id", productoIds);
  const costoDe = new Map(
    (productos ?? []).map((p) => [p.id as string, Number(p.costo ?? 0)])
  );

  return filas.reduce(
    (s, f) =>
      s + (costoDe.get(f.producto_id as string) ?? 0) * Number(f.cantidad),
    0
  );
}

async function isCajaDefault(
  supabase: SupabaseClient,
  tenantId: string,
  cajaId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("cajas")
    .select("es_default")
    .eq("tenant_id", tenantId)
    .eq("id", cajaId)
    .maybeSingle();
  return !!data?.es_default;
}

/**
 * Suma de pagos no anulados de una caja por concepto en [desde, hasta). Misma
 * regla de reembolsos que totalesEnRango: efectivo cuenta bruto (la salida
 * se descuenta aparte del cajón), tarjeta/transferencia/otro ya reembolsados
 * se excluyen — consistente con esa función y con "Cobrado hoy".
 */
async function totalesPorConceptoEnRango(
  supabase: SupabaseClient,
  tenantId: string,
  cajaId: string,
  desde: string,
  hasta: string
): Promise<CorteTotalesPorConcepto> {
  const [{ data }, costoProductos] = await Promise.all([
    supabase
      .from("pagos")
      .select("id, concepto, monto, metodo_pago, reembolsado_at")
      .eq("tenant_id", tenantId)
      .is("anulado_at", null)
      .gte("fecha_pago", desde)
      .lt("fecha_pago", hasta),
    costoProductosVendidosEnRango(supabase, tenantId, cajaId, desde, hasta),
  ]);

  const candidatos = data ?? [];
  const idsEnCaja = await pagoIdsEnCaja(
    supabase,
    tenantId,
    cajaId,
    candidatos.map((p) => p.id as string)
  );

  const t: CorteTotalesPorConcepto = {
    membresia: { cantidad: 0, total: 0 },
    visita: { cantidad: 0, total: 0 },
    producto: { cantidad: 0, total: 0 },
    otro: { cantidad: 0, total: 0 },
    gananciaProductos: 0,
  };

  for (const p of candidatos) {
    if (!idsEnCaja.has(p.id as string)) continue;
    if (p.metodo_pago !== "efectivo" && p.reembolsado_at) continue;
    const concepto = p.concepto as string;
    const key: keyof Omit<CorteTotalesPorConcepto, "gananciaProductos"> =
      concepto === "membresia" || concepto === "visita" || concepto === "producto"
        ? concepto
        : "otro";
    t[key].cantidad += 1;
    t[key].total += Number(p.monto);
  }

  t.gananciaProductos = t.producto.total - costoProductos;

  return t;
}

/** Desglose por concepto del turno en curso de una caja, hasta ahora. */
export async function resumenCorteEnVivoPorConcepto(
  tenantId: string,
  cajaId: string,
  desde: string
): Promise<CorteTotalesPorConcepto> {
  const supabase = await createClient();
  return totalesPorConceptoEnRango(
    supabase,
    tenantId,
    cajaId,
    desde,
    new Date().toISOString()
  );
}

/** Abre un turno en una caja. Falla si esa caja ya tiene uno abierto. */
export async function abrirCorte(
  tenantId: string,
  cajaId: string,
  input: { fondoInicial: number; userId: string | null; nombre: string | null }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cortes_caja")
    .insert({
      tenant_id: tenantId,
      caja_id: cajaId,
      fondo_inicial: input.fondoInicial,
      abierto_por: input.userId,
      abierto_por_nombre: input.nombre,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Esta caja ya tiene un turno abierto." };
    }
    return { ok: false, error: error?.message ?? "No se pudo abrir el turno." };
  }
  return { ok: true, id: data.id as string };
}

/** Cierra el turno: snapshot de totales + cuadre de efectivo. */
export async function cerrarCorte(
  tenantId: string,
  corteId: string,
  input: {
    efectivoContado: number;
    notas: string | null;
    userId: string | null;
    nombre: string | null;
  }
): Promise<{ ok: true; diferencia: number } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: corte } = await supabase
    .from("cortes_caja")
    .select("caja_id, abierto_at, fondo_inicial, estado")
    .eq("tenant_id", tenantId)
    .eq("id", corteId)
    .maybeSingle();
  if (!corte) return { ok: false, error: "Turno no encontrado." };
  if (corte.estado !== "abierto") {
    return { ok: false, error: "El turno ya está cerrado." };
  }

  const cajaId = corte.caja_id as string;
  const hasta = new Date().toISOString();
  const [t, porConcepto] = await Promise.all([
    totalesEnRango(supabase, tenantId, cajaId, corte.abierto_at as string, hasta),
    totalesPorConceptoEnRango(
      supabase,
      tenantId,
      cajaId,
      corte.abierto_at as string,
      hasta
    ),
  ]);
  const fondo = Number(corte.fondo_inicial);
  const esperado = fondo + t.efectivo - t.reembolsosEfectivo;
  const diferencia = input.efectivoContado - esperado;

  const { error } = await supabase
    .from("cortes_caja")
    .update({
      estado: "cerrado",
      cerrado_por: input.userId,
      cerrado_por_nombre: input.nombre,
      cerrado_at: hasta,
      total_efectivo: t.efectivo,
      total_tarjeta: t.tarjeta,
      total_transferencia: t.transferencia,
      efectivo_esperado: esperado,
      efectivo_contado: input.efectivoContado,
      diferencia,
      notas: input.notas,
      total_membresia: porConcepto.membresia.total,
      total_visita: porConcepto.visita.total,
      total_producto: porConcepto.producto.total,
      total_otro: porConcepto.otro.total,
      ganancia_productos: porConcepto.gananciaProductos,
    })
    .eq("tenant_id", tenantId)
    .eq("id", corteId)
    .eq("estado", "abierto"); // guard contra doble cierre

  if (error) return { ok: false, error: error.message };
  return { ok: true, diferencia };
}

/** Historial de cortes del gym, más recientes primero — opcionalmente de
 * una sola caja. */
export async function listCortes(
  tenantId: string,
  opts?: { cajaId?: string; limit?: number }
): Promise<CorteHistorial[]> {
  const supabase = await createClient();
  let query = supabase
    .from("cortes_caja")
    .select(
      "id, caja_id, estado, fondo_inicial, abierto_por_nombre, abierto_at, cerrado_por_nombre, cerrado_at, total_efectivo, total_tarjeta, total_transferencia, efectivo_esperado, efectivo_contado, diferencia, notas, total_membresia, total_visita, total_producto, total_otro, ganancia_productos"
    )
    .eq("tenant_id", tenantId)
    .order("abierto_at", { ascending: false })
    .limit(opts?.limit ?? 30);

  if (opts?.cajaId) query = query.eq("caja_id", opts.cajaId);

  const { data } = await query;

  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);

  return (data ?? []).map((c) => ({
    id: c.id as string,
    caja_id: c.caja_id as string,
    estado: c.estado as "abierto" | "cerrado",
    fondo_inicial: Number(c.fondo_inicial),
    abierto_por_nombre: (c.abierto_por_nombre as string | null) ?? null,
    abierto_at: c.abierto_at as string,
    cerrado_por_nombre: (c.cerrado_por_nombre as string | null) ?? null,
    cerrado_at: (c.cerrado_at as string | null) ?? null,
    total_efectivo: num(c.total_efectivo),
    total_tarjeta: num(c.total_tarjeta),
    total_transferencia: num(c.total_transferencia),
    efectivo_esperado: num(c.efectivo_esperado),
    efectivo_contado: num(c.efectivo_contado),
    diferencia: num(c.diferencia),
    notas: (c.notas as string | null) ?? null,
    total_membresia: num(c.total_membresia),
    total_visita: num(c.total_visita),
    total_producto: num(c.total_producto),
    total_otro: num(c.total_otro),
    ganancia_productos: num(c.ganancia_productos),
  }));
}
