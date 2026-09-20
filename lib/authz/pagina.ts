/**
 * Gate de PÁGINAS del panel (`page.tsx` / `layout.tsx`), leyendo la misma
 * política que la acción que esa página dispara. Así página y acción no
 * pueden divergir: si alguien cambia el mapa de permisos, cambia para las
 * dos a la vez. Diseño: docs/autorizacion-acciones.md §4.7.
 *
 * Orden distinto al de las acciones, a propósito: aquí el permiso va
 * primero. A quien no tiene el rol se le redirige sin enseñarle una
 * pantalla de upgrade que tampoco podría usar.
 */

import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasFeature, getRequiredPlan, type Feature, type Plan } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { PANEL, type PoliticaPanelId } from "./politicas";
import type { PanelCtx } from "./index";

export type GatePagina =
  | { ok: true; ctx: PanelCtx }
  | {
      ok: false;
      code: "SIN_PLAN";
      feature: Feature;
      /** Para `<UpgradePage planRequerido>`; nunca es "basico" (todo plan lo tiene). */
      planRequerido: Exclude<Plan, "basico">;
      ctx: PanelCtx;
    };

export interface RequirePanelOpts {
  /**
   * Ruta (relativa al slug, p. ej. "/checkins") a la que se redirige a quien
   * no tiene el permiso. Obligatoria: cada sección tiene su "casa".
   */
  sinPermiso: string;
}

/**
 * Uso en una página:
 *
 *   const g = await requirePanel("config.tag_crear", { sinPermiso: "/checkins" });
 *   if (!g.ok) return <UpgradePage planRequerido={g.planRequerido} … />;
 *   const { ctx } = g;
 *
 * Sin permiso → `redirect()` (lanza; la página no sigue). Sin plan →
 * `{ ok: false }` para que la página pinte su UpgradePage con su propio
 * texto. Con ambos → `ctx` (id, slug, plan, role, can, has).
 */
export async function requirePanel(
  politica: PoliticaPanelId,
  opts: RequirePanelOpts
): Promise<GatePagina> {
  const { feature, permission } = PANEL[politica];
  const tenant = await getTenant();
  const ctx: PanelCtx = {
    ...tenant,
    can: (p) => hasPermission(tenant.role, p),
    has: (f) => hasFeature(tenant.plan, f),
  };

  if (!hasPermission(tenant.role, permission)) {
    redirect(`/${tenant.slug}${opts.sinPermiso}`);
  }
  if (!hasFeature(tenant.plan, feature)) {
    return {
      ok: false,
      code: "SIN_PLAN",
      feature,
      planRequerido: getRequiredPlan(feature) as Exclude<Plan, "basico">,
      ctx,
    };
  }
  return { ok: true, ctx };
}
