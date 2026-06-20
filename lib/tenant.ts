import { headers } from "next/headers";
import type { Plan } from "./features";
import type { StaffRol } from "./types/staff";

export interface TenantContext {
  id: string;
  slug: string;
  plan: Plan;
  /**
   * Rol del usuario actual en este gym. Lo resuelve el middleware y lo
   * inyecta como header `x-staff-role`. Sirve para gates server-side
   * (vía hasPermission). El objeto Staff completo lo carga el layout.
   */
  role: StaffRol;
}

/**
 * Lee el contexto del tenant desde los headers que el middleware
 * inyecta en cada request (x-tenant-id, x-tenant-slug, x-tenant-plan,
 * x-staff-role).
 *
 * Solo usar en Server Components / Route Handlers dentro de
 * app/(tenant)/[slug]/* — el middleware garantiza que estos headers
 * existen para esas rutas.
 */
export async function getTenant(): Promise<TenantContext> {
  const headerStore = await headers();

  const id = headerStore.get("x-tenant-id");
  const slug = headerStore.get("x-tenant-slug");
  const plan = headerStore.get("x-tenant-plan") as Plan | null;
  // Default defensivo a 'owner' para no bloquear al dueño si por alguna
  // razón el header faltara; el middleware lo setea siempre en rutas de
  // tenant, así que un recepcionista nunca llega sin él.
  const role = (headerStore.get("x-staff-role") as StaffRol | null) ?? "owner";

  if (!id || !slug || !plan) {
    throw new Error(
      "getTenant() llamado fuera de una ruta de tenant válida — " +
        "verifica que el middleware esté corriendo para esta ruta."
    );
  }

  return { id, slug, plan, role };
}
