import { headers } from "next/headers";
import type { Plan } from "./features";

export interface TenantContext {
  id: string;
  slug: string;
  plan: Plan;
}

/**
 * Lee el contexto del tenant desde los headers que el middleware
 * inyecta en cada request (x-tenant-id, x-tenant-slug, x-tenant-plan).
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

  if (!id || !slug || !plan) {
    throw new Error(
      "getTenant() llamado fuera de una ruta de tenant válida — " +
        "verifica que el middleware esté corriendo para esta ruta."
    );
  }

  return { id, slug, plan };
}
