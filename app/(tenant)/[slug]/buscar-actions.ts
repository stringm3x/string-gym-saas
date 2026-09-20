"use server";

import { panelAction } from "@/lib/authz";
import { searchMiembrosForCheckin } from "@/lib/queries/miembros.queries";

export interface ResultadoBusqueda {
  id: string;
  nombre: string;
  telefono: string | null;
}

/** Búsqueda global de miembros por nombre/teléfono (scoped al tenant). */
export const buscarMiembrosAction = panelAction(
  "panel.buscar_miembros",
  { onDenied: () => [] },
  async (tenant, query: string): Promise<ResultadoBusqueda[]> => {
    const miembros = await searchMiembrosForCheckin(tenant.id, query);
    return miembros.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      telefono: m.telefono,
    }));
  }
);
