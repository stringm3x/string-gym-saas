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
