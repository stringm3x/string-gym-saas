"use server";

import { getTenant } from "@/lib/tenant";
import { searchMiembrosForCheckin } from "@/lib/queries/miembros.queries";

export interface ResultadoBusqueda {
  id: string;
  nombre: string;
  telefono: string | null;
}

/** Búsqueda global de miembros por nombre/teléfono (scoped al tenant). */
export async function buscarMiembrosAction(
  query: string
): Promise<ResultadoBusqueda[]> {
  const tenant = await getTenant();
  const miembros = await searchMiembrosForCheckin(tenant.id, query);
  return miembros.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    telefono: m.telefono,
  }));
}
