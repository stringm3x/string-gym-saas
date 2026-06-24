import { createAdminClient } from "@/lib/supabase/admin";
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
