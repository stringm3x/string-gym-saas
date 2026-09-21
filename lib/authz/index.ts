/**
 * Constructores de Server Actions autorizadas — uno por clase de acción.
 * No existe un constructor genérico con campos opcionales: "no aplica" se
 * expresa eligiendo otra clase, y la clase está amarrada a la carpeta
 * (scripts/authz-registry.mjs + eslint-rules/authz-export.mjs).
 *
 * Diseño completo y plan de migración: docs/autorizacion-acciones.md.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenant, type TenantContext } from "@/lib/tenant";
import {
  hasFeature,
  getRequiredPlan,
  PLAN_LABELS,
  type Feature,
  type Plan,
} from "@/lib/features";
import { hasPermission, PERMISSION_LABELS } from "@/lib/permissions";
import type { Permission } from "@/lib/types/staff";
import type { StringAdmin } from "@/lib/types/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMiembroByQrToken, type MiembroQrScan } from "@/lib/queries/qr.queries";
import {
  getPortalGym,
  type PortalGym,
  type SessionMiembro,
} from "@/lib/queries/portal.queries";
import { getPortalSession } from "@/lib/portal/session";
import { gymOperativo } from "@/lib/utils/gym-operativo";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import {
  PANEL,
  PORTAL,
  KIOSCO,
  ADMIN,
  type PoliticaPanel,
  type PoliticaPortal,
  type PoliticaKiosco,
  type PoliticaAdmin,
  type PoliticaPanelId,
  type PoliticaPortalId,
  type PoliticaKioscoId,
  type PoliticaAdminId,
  type PropositoAnon,
} from "./politicas";
import {
  AUTHZ,
  type AuthzCode,
  type Denegado,
  type Guarded,
  type Kind,
  type OnDenied,
} from "./tipos";

export type { Denegado, AuthzCode, Guarded } from "./tipos";

// ───────────────────────────── infraestructura ─────────────────────────────

const MENSAJES: Record<Exclude<AuthzCode, "SIN_PLAN" | "SIN_PERMISO">, string> = {
  SIN_SESION: "Tu sesión expiró. Vuelve a entrar.",
  IDENTIDAD_INVALIDA:
    "No se pudo verificar tu identidad. Vuelve a escanear tu QR.",
  GYM_NO_ENCONTRADO: "Gimnasio no encontrado.",
  // Neutral a propósito (bloque 10): kiosco/portal hablan con el socio, no
  // con el gimnasio — "suspendido por falta de pago" es asunto entre el
  // gimnasio y STRING, no algo para mostrarle a quien va a entrenar.
  GYM_NO_OPERATIVO:
    "Este gimnasio no está disponible en este momento. Consulta directamente con el gimnasio.",
};

function mensajePlan(feature: Feature): string {
  return `Esta función requiere el plan ${PLAN_LABELS[getRequiredPlan(feature)]}.`;
}

function mensajePermiso(permission: Permission): string {
  return `No tienes permiso para ${PERMISSION_LABELS[permission]}.`;
}

/**
 * Construye la denegación, la registra (una línea JSON greppable en los
 * logs: `authz.denied`) y la convierte a la forma de retorno de la acción.
 */
function negar<R>(
  opts: OnDenied<R>,
  kind: Kind,
  politica: string,
  code: AuthzCode,
  error: string,
  detalle: Record<string, string | null | undefined> = {}
): R {
  const d: Denegado = { ok: false, error, code };
  console.warn(
    JSON.stringify({ tag: "authz.denied", kind, politica, code, ...detalle })
  );
  const onDenied = (opts as { onDenied?: (d: Denegado) => R }).onDenied;
  return onDenied ? onDenied(d) : (d as unknown as R);
}

function marcar<K extends Kind, A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  kind: K
): Guarded<K, A, R> {
  return Object.assign(fn, { [AUTHZ]: kind }) as Guarded<K, A, R>;
}

// ──────────────────────────────── PANEL ────────────────────────────────

export interface PanelCtx extends TenantContext {
  /** Permiso condicional dentro del cuerpo (p. ej. cobrar al inscribir). */
  can(permission: Permission): boolean;
  /** Segunda feature dentro del cuerpo (la principal ya la verificó la política). */
  has(feature: Feature): boolean;
}

/**
 * Acción del panel del gimnasio: sesión de staff resuelta por proxy.ts.
 * Exige feature del plan Y permiso del rol, ambos desde `PANEL`.
 */
export function panelAction<A extends unknown[], R>(
  politica: PoliticaPanelId,
  opts: OnDenied<R>,
  handler: (ctx: PanelCtx, ...args: A) => Promise<R>
): Guarded<"panel", A, R> {
  const { feature, permission }: PoliticaPanel = PANEL[politica];
  const fn = async (...args: A): Promise<R> => {
    const tenant = await getTenant();
    const detalle = { tenantId: tenant.id, plan: tenant.plan, role: tenant.role };
    if (!hasFeature(tenant.plan, feature)) {
      return negar(opts, "panel", politica, "SIN_PLAN", mensajePlan(feature), detalle);
    }
    if (!hasPermission(tenant.role, permission)) {
      return negar(opts, "panel", politica, "SIN_PERMISO", mensajePermiso(permission), detalle);
    }
    const ctx: PanelCtx = {
      ...tenant,
      can: (p) => hasPermission(tenant.role, p),
      has: (f) => hasFeature(tenant.plan, f),
    };
    return handler(ctx, ...args);
  };
  return marcar(fn, "panel");
}

// ──────────────────────────────── PORTAL ────────────────────────────────

export interface PortalCtx {
  gym: PortalGym;
  /** Sesión OTP del socio. Toda query del portal recibe `session.miembroId` de aquí, nunca del input. */
  session: SessionMiembro;
  admin: SupabaseClient;
  has(feature: Feature): boolean;
}

/**
 * Acción del portal del socio. Firma pública: (slug, ...args). Verifica
 * que el gym exista y tenga `portal_miembro` más la feature declarada, y
 * que la cookie OTP sea una sesión vigente de ESE gym. Sin rol: no hay staff.
 */
export function portalAction<A extends unknown[], R>(
  politica: PoliticaPortalId,
  opts: OnDenied<R>,
  handler: (ctx: PortalCtx, ...args: A) => Promise<R>
): Guarded<"portal", [slug: string, ...args: A], R> {
  const { feature }: PoliticaPortal = PORTAL[politica];
  const fn = async (slug: string, ...args: A): Promise<R> => {
    const gym = await getPortalGym(slug);
    if (!gym) {
      return negar(opts, "portal", politica, "GYM_NO_ENCONTRADO", MENSAJES.GYM_NO_ENCONTRADO, { slug });
    }
    const detalle = { tenantId: gym.id, plan: gym.plan };
    if (!gymOperativo(gym)) {
      return negar(opts, "portal", politica, "GYM_NO_OPERATIVO", MENSAJES.GYM_NO_OPERATIVO, detalle);
    }
    if (!hasFeature(gym.plan, "portal_miembro")) {
      return negar(opts, "portal", politica, "SIN_PLAN", mensajePlan("portal_miembro"), detalle);
    }
    if (!hasFeature(gym.plan, feature)) {
      return negar(opts, "portal", politica, "SIN_PLAN", mensajePlan(feature), detalle);
    }
    const session = await getPortalSession();
    if (!session || session.tenantId !== gym.id) {
      return negar(opts, "portal", politica, "SIN_SESION", MENSAJES.SIN_SESION, detalle);
    }
    const ctx: PortalCtx = {
      gym,
      session,
      admin: createAdminClient(),
      has: (f) => hasFeature(gym.plan, f),
    };
    return handler(ctx, ...args);
  };
  return marcar(fn, "portal");
}

// ──────────────────────────────── KIOSCO ────────────────────────────────

export interface KioscoGym {
  id: string;
  slug: string;
  plan: Plan;
  checkin_bloquea_vencidos: boolean | null;
  mp_access_token: string | null;
  estado: string;
  prueba_hasta: string | null;
}

export interface KioscoCtx {
  gym: KioscoGym;
  /** Socio resuelto del qr_token escaneado. No existe otro `miembroId`. */
  miembro: MiembroQrScan;
  admin: SupabaseClient;
  has(feature: Feature): boolean;
}

/**
 * Acción pública del kiosco. Firma pública: (slug, token, ...args). Sin
 * sesión: la identidad es el qr_token, y el handler recibe al socio ya
 * resuelto. Las reglas de negocio sobre ese socio (archivado, vencido,
 * congelado) siguen en el cuerpo, porque cambian por acción.
 */
export function kioscoAction<A extends unknown[], R>(
  politica: PoliticaKioscoId,
  opts: OnDenied<R>,
  handler: (ctx: KioscoCtx, ...args: A) => Promise<R>
): Guarded<"kiosco", [slug: string, token: string, ...args: A], R> {
  const { feature }: PoliticaKiosco = KIOSCO[politica];
  const fn = async (slug: string, token: string, ...args: A): Promise<R> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("gyms")
      .select(
        "id, slug, plan, checkin_bloquea_vencidos, mp_access_token, estado, prueba_hasta"
      )
      .eq("slug", slug)
      .maybeSingle();
    const gym = data as KioscoGym | null;
    if (!gym) {
      return negar(opts, "kiosco", politica, "GYM_NO_ENCONTRADO", MENSAJES.GYM_NO_ENCONTRADO, { slug });
    }
    const detalle = { tenantId: gym.id, plan: gym.plan };
    if (!gymOperativo(gym)) {
      return negar(opts, "kiosco", politica, "GYM_NO_OPERATIVO", MENSAJES.GYM_NO_OPERATIVO, detalle);
    }
    if (!hasFeature(gym.plan, feature)) {
      return negar(opts, "kiosco", politica, "SIN_PLAN", mensajePlan(feature), detalle);
    }
    const t = (token || "").trim();
    const miembro = t ? await getMiembroByQrToken(gym.id, t, admin) : null;
    if (!miembro) {
      return negar(opts, "kiosco", politica, "IDENTIDAD_INVALIDA", MENSAJES.IDENTIDAD_INVALIDA, detalle);
    }
    const ctx: KioscoCtx = {
      gym,
      miembro,
      admin,
      has: (f) => hasFeature(gym.plan, f),
    };
    return handler(ctx, ...args);
  };
  return marcar(fn, "kiosco");
}

// ──────────────────────────────── ADMIN ────────────────────────────────

export interface AdminCtx {
  admin: StringAdmin;
}

/**
 * Acción del panel admin de STRING: gateada contra `string_admins` activo
 * y contra el rol interno declarado (`admin` o `super_admin`). Sin plan.
 */
export function adminAction<A extends unknown[], R>(
  politica: PoliticaAdminId,
  opts: OnDenied<R>,
  handler: (ctx: AdminCtx, ...args: A) => Promise<R>
): Guarded<"admin", A, R> {
  const { rol }: PoliticaAdmin = ADMIN[politica];
  const fn = async (...args: A): Promise<R> => {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return negar(opts, "admin", politica, "SIN_SESION", "Acceso denegado.");
    }
    if (rol === "super_admin" && admin.role !== "super_admin") {
      return negar(opts, "admin", politica, "SIN_PERMISO", "Solo un super admin puede hacer esto.", {
        adminId: admin.user_id,
        role: admin.role,
      });
    }
    return handler({ admin }, ...args);
  };
  return marcar(fn, "admin");
}

// ──────────────────────────────── ANÓNIMA ────────────────────────────────

/**
 * Acción sin sesión por definición (login, OTP, recuperar contraseña,
 * cerrar sesión). No verifica nada; el propósito viene de la unión
 * cerrada `PropositoAnon`, así que no es una puerta trasera sino una
 * declaración explícita de "aquí no hay a quién autorizar".
 */
export function anonAction<A extends unknown[], R>(
  proposito: PropositoAnon,
  handler: (...args: A) => Promise<R>
): Guarded<"anon", A, R> & { readonly proposito: PropositoAnon } {
  const fn = async (...args: A): Promise<R> => handler(...args);
  return Object.assign(marcar(fn, "anon"), { proposito });
}
