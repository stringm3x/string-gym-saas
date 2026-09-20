import { headers } from "next/headers";
import type { Plan } from "./features";
import type { StaffRol } from "./types/staff";

export interface TenantContext {
  id: string;
  slug: string;
  plan: Plan;
  /**
   * Rol del usuario actual en este gym. Lo resuelve proxy.ts y lo inyecta
   * como request header `x-staff-role`. Sirve para gates server-side (vía
   * hasPermission / lib/authz). El objeto Staff completo lo carga el layout.
   */
  role: StaffRol;
}

const PLANES: readonly string[] = ["basico", "pro", "escala"];
const ROLES: readonly string[] = ["owner", "gerente", "receptionist", "entrenador"];

/**
 * Lee el contexto del tenant desde los request headers que proxy.ts
 * inyecta (x-tenant-id, x-tenant-slug, x-tenant-plan, x-staff-role).
 *
 * Solo usar en Server Components / Server Actions / Route Handlers dentro
 * de app/(tenant)/[slug]/*: el proxy garantiza esos headers ahí, y borra
 * cualquiera que venga del cliente.
 *
 * Falla cerrado: si falta o es inválido cualquiera de los cuatro, lanza.
 * No hay default de rol — un default a `owner` sería fail-open.
 */
export async function getTenant(): Promise<TenantContext> {
  const headerStore = await headers();

  const id = headerStore.get("x-tenant-id");
  const slug = headerStore.get("x-tenant-slug");
  const plan = headerStore.get("x-tenant-plan");
  const role = headerStore.get("x-staff-role");

  if (
    !id ||
    !slug ||
    !plan ||
    !PLANES.includes(plan) ||
    !role ||
    !ROLES.includes(role)
  ) {
    throw new Error(
      "getTenant() sin contexto de tenant: faltan o son inválidos los headers " +
        "de proxy.ts. Esta ruta no pasó por el proxy o no es una ruta de tenant."
    );
  }

  return { id, slug, plan: plan as Plan, role: role as StaffRol };
}
