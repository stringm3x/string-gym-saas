import { createAdminClient } from "@/lib/supabase/admin";
import { TZ_MX } from "@/lib/utils/dates";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import { tenantMrr } from "@/lib/admin/pricing";

/** Estados canónicos de un tenant en el Admin. */
export type TenantEstado = "activo" | "prueba" | "suspendido" | "cancelado";

export type TenantOrden = "recientes" | "nombre" | "mrr";
export type TenantAntiguedad = "mes" | "trimestre" | "antiguos";

export interface TenantFilters {
  estado?: string;
  plan?: string;
  antiguedad?: string;
  search?: string;
  orden?: string;
}

export interface AdminTenantRow {
  id: string;
  slug: string;
  nombre: string;
  plan: string;
  estado: string;
  owner_email: string | null;
  created_at: string;
  fecha_inicio_suscripcion: string | null;
  dias_en_plataforma: number;
  mrr: number;
}

/** Resuelve owner_id → email vía Auth Admin API (service-role). */
async function resolveOwnerEmails(
  ownerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ownerIds.length === 0) return map;

  const admin = createAdminClient();
  // Pre-lanzamiento: una página cubre todos los usuarios. Si algún día
  // hay >1000, habría que paginar (page++) hasta agotar.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (u.email) map.set(u.id, u.email);
  }
  return map;
}

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Lista todos los tenants para el Admin. Usa service-role (bypassa RLS)
 * porque el super admin no está atado a la RLS de cada gym. Verifica
 * is_super_admin antes de tocar nada (defensa en profundidad: el layout
 * del panel ya gatea, esto lo refuerza a nivel de query).
 *
 * Las lecturas NO se loguean en admin_events (sería ruido); el audit log
 * registra mutaciones (Bloque 4).
 */
export async function listTenantsAdmin(
  filters: TenantFilters = {}
): Promise<AdminTenantRow[]> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  let query = admin
    .from("gyms")
    .select(
      "id, slug, nombre, plan, estado, owner_id, created_at, fecha_inicio_suscripcion"
    );

  if (filters.estado) query = query.eq("estado", filters.estado);
  if (filters.plan) query = query.eq("plan", filters.plan);

  // Antigüedad por created_at.
  if (filters.antiguedad === "mes") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    query = query.gte("created_at", d.toISOString());
  } else if (filters.antiguedad === "trimestre") {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    query = query.gte("created_at", d.toISOString());
  } else if (filters.antiguedad === "antiguos") {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    query = query.lt("created_at", d.toISOString());
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const emails = await resolveOwnerEmails(
    data.map((g) => g.owner_id).filter(Boolean)
  );

  let rows: AdminTenantRow[] = data.map((g) => ({
    id: g.id,
    slug: g.slug,
    nombre: g.nombre,
    plan: g.plan,
    estado: g.estado,
    owner_email: emails.get(g.owner_id) ?? null,
    created_at: g.created_at,
    fecha_inicio_suscripcion: g.fecha_inicio_suscripcion,
    dias_en_plataforma: diasDesde(g.created_at),
    mrr: tenantMrr(g.plan, g.estado),
  }));

  // Búsqueda libre (nombre / slug / email) — en memoria (escala pre-venta).
  const term = filters.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (r) =>
        r.nombre.toLowerCase().includes(term) ||
        r.slug.toLowerCase().includes(term) ||
        (r.owner_email?.toLowerCase().includes(term) ?? false)
    );
  }

  // Ordenamiento.
  const orden = filters.orden ?? "recientes";
  rows.sort((a, b) => {
    if (orden === "nombre") return a.nombre.localeCompare(b.nombre);
    if (orden === "mrr") return b.mrr - a.mrr;
    // recientes (default)
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  return rows;
}

// ─────────────────────────── Detalle ───────────────────────────

export interface TenantDetail {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
  plan: string;
  estado: string;
  created_at: string;
  fecha_inicio_suscripcion: string | null;
  es_fundador: boolean;
  fundador_desde: string | null;
  prueba_hasta: string | null;
  suspendido_at: string | null;
  suspension_motivo: string | null;
  telefono: string | null;
  direccion: string | null;
  rfc: string | null;
  dominio_custom: string | null;
  owner_id: string;
  owner_email: string | null;
  mrr: number;
}

export interface TenantMetrics {
  miembros: number;
  prospectos: number;
  pagosUltimoMes: number;
  ultimoCheckin: string | null;
}

export interface TenantAddon {
  addon_id: string;
  estado: "activo" | "suspendido" | "cancelado";
  fecha_activacion: string;
  precio_actual: number;
}

export interface TenantNota {
  id: string;
  nota: string;
  admin_email: string;
  created_at: string;
}

export interface TenantPagoManual {
  id: string;
  concepto: string;
  monto: number;
  metodo: string;
  referencia: string | null;
  fecha_pago: string;
  notas: string | null;
  admin_email: string;
  created_at: string;
}

export interface TenantAdminEvent {
  id: string;
  accion: string;
  admin_email: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Detalle completo de un tenant (gate + service-role). */
export async function getTenantDetailAdmin(
  tenantId: string
): Promise<TenantDetail | null> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  const { data: g, error } = await admin
    .from("gyms")
    .select(
      "id, slug, nombre, logo_url, plan, estado, created_at, fecha_inicio_suscripcion, es_fundador, fundador_desde, prueba_hasta, suspendido_at, suspension_motivo, telefono, direccion, rfc, dominio_custom, owner_id"
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !g) return null;

  let owner_email: string | null = null;
  if (g.owner_id) {
    const { data: u } = await admin.auth.admin.getUserById(g.owner_id);
    owner_email = u?.user?.email ?? null;
  }

  return {
    ...g,
    es_fundador: Boolean(g.es_fundador),
    owner_email,
    mrr: tenantMrr(g.plan, g.estado),
  } as TenantDetail;
}

/** Métricas rápidas del tenant. */
export async function getTenantMetrics(
  tenantId: string
): Promise<TenantMetrics> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();

  const [miembros, prospectos, pagos, checkin] = await Promise.all([
    admin
      .from("miembros")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("archivado", false),
    admin
      .from("prospectos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    (() => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 30);
      return admin
        .from("pagos")
        .select("monto")
        .eq("tenant_id", tenantId)
        .is("anulado_at", null)
        .is("reembolsado_at", null)
        .gte("fecha_pago", desde.toISOString());
    })(),
    admin
      .from("checkins")
      .select("fecha_hora")
      .eq("tenant_id", tenantId)
      .order("fecha_hora", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const pagosUltimoMes = (pagos.data ?? []).reduce(
    (sum, p) => sum + Number(p.monto ?? 0),
    0
  );

  return {
    miembros: miembros.count ?? 0,
    prospectos: prospectos.count ?? 0,
    pagosUltimoMes,
    ultimoCheckin: checkin.data?.fecha_hora ?? null,
  };
}

/** Add-ons registrados del tenant. */
export async function getTenantAddons(
  tenantId: string
): Promise<TenantAddon[]> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  const { data } = await admin
    .from("gym_addons")
    .select("addon_id, estado, fecha_activacion, precio_actual")
    .eq("tenant_id", tenantId);

  return (data ?? []).map((a) => ({
    ...a,
    precio_actual: Number(a.precio_actual),
  })) as TenantAddon[];
}

/** Notas internas del tenant (timeline). */
export async function listTenantNotas(
  tenantId: string
): Promise<TenantNota[]> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_tenant_notas")
    .select("id, nota, admin_email, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (data ?? []) as TenantNota[];
}

/**
 * Pagos manuales del tenant (B2B). Si la migración 023 aún no se aplicó,
 * la tabla no existe → devuelve [] sin romper la página.
 */
export async function listTenantPagosManuales(
  tenantId: string
): Promise<TenantPagoManual[]> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_tenant_pagos")
    .select("id, concepto, monto, metodo, referencia, fecha_pago, notas, admin_email, created_at")
    .eq("tenant_id", tenantId)
    .order("fecha_pago", { ascending: false });

  if (error) return [];
  return (data ?? []).map((p) => ({
    ...p,
    monto: Number(p.monto),
  })) as TenantPagoManual[];
}

/** Últimos eventos administrativos de este tenant. */
export async function getTenantAdminEvents(
  tenantId: string,
  limit = 20
): Promise<TenantAdminEvent[]> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_events")
    .select("id, accion, admin_email, metadata, created_at")
    .eq("target_tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as TenantAdminEvent[];
}

// ═══════════════════════ Bloque 5 — Dashboard / Eventos ═══════════════════════

export interface AdminDashboardMetrics {
  activos: number;
  prueba: number;
  pruebaDiasPromedio: number | null;
  suspendidos: number;
  mrrTotal: number;
  nuevosEsteMes: number;
  churnEsteMes: number;
}

function inicioDeMes(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

function diasHasta(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Métricas globales para el dashboard del admin. */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  const { data: gyms } = await admin
    .from("gyms")
    .select("plan, estado, created_at, prueba_hasta");

  const rows = gyms ?? [];
  const first = inicioDeMes().toISOString();

  let activos = 0,
    prueba = 0,
    suspendidos = 0,
    mrrTotal = 0,
    nuevosEsteMes = 0;
  const diasPrueba: number[] = [];

  for (const g of rows) {
    if (g.estado === "activo") activos++;
    else if (g.estado === "prueba") {
      prueba++;
      const d = diasHasta(g.prueba_hasta);
      if (d !== null) diasPrueba.push(Math.max(0, d));
    } else if (g.estado === "suspendido") suspendidos++;

    mrrTotal += tenantMrr(g.plan, g.estado);
    if (g.created_at >= first) nuevosEsteMes++;
  }

  // Churn del mes: cancelaciones registradas en el audit log.
  const { count: churnEsteMes } = await admin
    .from("admin_events")
    .select("id", { count: "exact", head: true })
    .eq("accion", "tenant.cancelar")
    .gte("created_at", first);

  const pruebaDiasPromedio = diasPrueba.length
    ? Math.round(diasPrueba.reduce((a, b) => a + b, 0) / diasPrueba.length)
    : null;

  return {
    activos,
    prueba,
    pruebaDiasPromedio,
    suspendidos,
    mrrTotal,
    nuevosEsteMes,
    churnEsteMes: churnEsteMes ?? 0,
  };
}

export interface AtencionTenant {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  estado: string;
  detalle: string;
}

export interface TenantsAtencion {
  pruebaPorVencer: AtencionTenant[];
  suspendidosViejos: AtencionTenant[];
  exportPendiente: AtencionTenant[];
}

/** Los 3 casos de tenants que requieren atención. */
export async function getTenantsRequierenAtencion(): Promise<TenantsAtencion> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  const { data: gyms } = await admin
    .from("gyms")
    .select("id, nombre, slug, plan, estado, prueba_hasta, suspendido_at");

  const rows = gyms ?? [];
  const ahora = Date.now();
  const en7d = ahora + 7 * 86_400_000;
  const hace30d = ahora - 30 * 86_400_000;

  const pruebaPorVencer: AtencionTenant[] = [];
  const suspendidosViejos: AtencionTenant[] = [];

  for (const g of rows) {
    if (g.estado === "prueba" && g.prueba_hasta) {
      const t = new Date(g.prueba_hasta).getTime();
      if (t >= ahora && t <= en7d) {
        const d = Math.ceil((t - ahora) / 86_400_000);
        pruebaPorVencer.push({
          id: g.id,
          nombre: g.nombre,
          slug: g.slug,
          plan: g.plan,
          estado: g.estado,
          detalle: `Vence en ${d} día${d === 1 ? "" : "s"}`,
        });
      }
    }
    if (g.estado === "suspendido" && g.suspendido_at) {
      if (new Date(g.suspendido_at).getTime() < hace30d) {
        suspendidosViejos.push({
          id: g.id,
          nombre: g.nombre,
          slug: g.slug,
          plan: g.plan,
          estado: g.estado,
          detalle: `Suspendido desde ${new Date(g.suspendido_at).toLocaleDateString("es-MX", { timeZone: TZ_MX })}`,
        });
      }
    }
  }

  // Export pendiente: cancelaciones con exportar_datos_pendiente = true.
  const byId = new Map(rows.map((g) => [g.id, g]));
  const { data: cancelEvents } = await admin
    .from("admin_events")
    .select("target_tenant_id, metadata")
    .eq("accion", "tenant.cancelar");

  const exportPendiente: AtencionTenant[] = [];
  const vistos = new Set<string>();
  for (const e of cancelEvents ?? []) {
    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    if (meta.exportar_datos_pendiente !== true) continue;
    const id = e.target_tenant_id as string | null;
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const g = byId.get(id);
    if (!g) continue;
    exportPendiente.push({
      id: g.id,
      nombre: g.nombre,
      slug: g.slug,
      plan: g.plan,
      estado: g.estado,
      detalle: "Exportación de datos pendiente",
    });
  }

  return { pruebaPorVencer, suspendidosViejos, exportPendiente };
}

export interface EventoLogRow {
  id: string;
  accion: string;
  admin_email: string;
  target_tenant_id: string | null;
  tenant_nombre: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EventosLogFilters {
  accion?: string;
  tenantId?: string;
  desde?: string;
  hasta?: string;
}

export interface EventosLogResult {
  rows: EventoLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Audit log completo con filtros y paginación. */
export async function getAdminEventosLog(
  filters: EventosLogFilters = {},
  page = 1,
  pageSize = 20
): Promise<EventosLogResult> {
  const current = await getCurrentAdmin();
  if (!current) throw new Error("Acceso denegado");

  const admin = createAdminClient();
  let query = admin
    .from("admin_events")
    .select("id, accion, admin_email, target_tenant_id, metadata, created_at", {
      count: "exact",
    });

  if (filters.accion) query = query.eq("accion", filters.accion);
  if (filters.tenantId) query = query.eq("target_tenant_id", filters.tenantId);
  if (filters.desde) query = query.gte("created_at", filters.desde);
  if (filters.hasta) query = query.lte("created_at", filters.hasta);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  // Resolver nombres de tenants.
  const { data: gyms } = await admin.from("gyms").select("id, nombre");
  const nombres = new Map((gyms ?? []).map((g) => [g.id, g.nombre]));

  const rows: EventoLogRow[] = (data ?? []).map((e) => ({
    id: e.id,
    accion: e.accion,
    admin_email: e.admin_email,
    target_tenant_id: e.target_tenant_id,
    tenant_nombre: e.target_tenant_id
      ? nombres.get(e.target_tenant_id) ?? null
      : null,
    metadata: (e.metadata ?? {}) as Record<string, unknown>,
    created_at: e.created_at,
  }));

  return { rows, total: count ?? 0, page, pageSize };
}
