"use server";

import { revalidatePath } from "next/cache";
import { panelAction, type PanelCtx } from "@/lib/authz";
import {
  createNota,
  listNotas,
  toggleNotaCompletada,
  type Nota,
  type TipoAccion,
} from "@/lib/queries/notas.queries";

export interface NotaFormState {
  ok: boolean;
  error: string | null;
}

type EntidadTipo = "miembro" | "prospecto";

// Política `usar_panel` = ausencia declarada de permiso: las notas son
// operación diaria de los cuatro roles. Pero el PROSPECTO en sí solo lo ven
// owner y gerente (ver_prospectos), así que sus notas heredan ese permiso
// aquí, en el cuerpo, como permiso condicional (docs/autorizacion-acciones.md §4.1).
function puedeVerEntidad(tenant: PanelCtx, entidadTipo: EntidadTipo): boolean {
  return entidadTipo === "miembro" || tenant.can("ver_prospectos");
}

const SIN_PERMISO_PROSPECTO = "No tienes permiso para ver prospectos.";

export const createNotaAction = panelAction(
  "notas.crear",
  {},
  async (
    tenant,
    entidadTipo: EntidadTipo,
    entidadId: string,
    _prev: NotaFormState,
    formData: FormData
  ): Promise<NotaFormState> => {
    if (!puedeVerEntidad(tenant, entidadTipo)) {
      return { ok: false, error: SIN_PERMISO_PROSPECTO };
    }
    const contenido = String(formData.get("contenido") ?? "").trim();
    const fechaSeguimiento = String(formData.get("fecha_seguimiento") ?? "").trim();

    if (!contenido) return { ok: false, error: "La nota no puede estar vacía" };

    const result = await createNota(
      tenant.id,
      entidadTipo,
      entidadId,
      contenido,
      undefined,
      fechaSeguimiento || null
    );
    if (!result.ok) return { ok: false, error: result.error };

    if (entidadTipo === "miembro") {
      revalidatePath(`/${tenant.slug}/miembros/${entidadId}`);
      revalidatePath(`/${tenant.slug}/miembros`);
    } else {
      revalidatePath(`/${tenant.slug}/prospectos`);
    }

    return { ok: true, error: null };
  }
);

/** Solo se usa en la ficha del miembro (NotasTimeline/SeguimientosPendientes). */
export const toggleNotaCompletadaAction = panelAction(
  "notas.toggle_completada",
  {},
  async (tenant, notaId: string, completada: boolean): Promise<{ ok: boolean; error?: string }> => {
    const result = await toggleNotaCompletada(tenant.id, notaId, completada);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/${tenant.slug}/miembros`);
    return { ok: true };
  }
);

export const registrarAccionAction = panelAction(
  "notas.registrar_accion",
  {},
  async (
    tenant,
    entidadTipo: EntidadTipo,
    entidadId: string,
    contenido: string,
    tipoAccion: TipoAccion
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!puedeVerEntidad(tenant, entidadTipo)) {
      return { ok: false, error: SIN_PERMISO_PROSPECTO };
    }

    const result = await createNota(
      tenant.id,
      entidadTipo,
      entidadId,
      contenido,
      tipoAccion
    );

    if (!result.ok) return { ok: false, error: result.error };

    if (entidadTipo === "miembro") {
      revalidatePath(`/${tenant.slug}/miembros/${entidadId}`);
    } else {
      revalidatePath(`/${tenant.slug}/prospectos`);
    }

    return { ok: true };
  }
);

export const listNotasAction = panelAction(
  "notas.listar",
  { onDenied: () => [] },
  async (tenant, entidadTipo: EntidadTipo, entidadId: string): Promise<Nota[]> => {
    if (!puedeVerEntidad(tenant, entidadTipo)) return [];
    return listNotas(tenant.id, entidadTipo, entidadId);
  }
);
