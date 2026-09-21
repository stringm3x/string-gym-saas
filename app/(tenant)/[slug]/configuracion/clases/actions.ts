"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { panelAction } from "@/lib/authz";
import {
  createClase,
  updateClase,
  toggleClaseActiva,
  getClaseById,
  insertSesiones,
  limpiarSesionesFuturasSinReservas,
} from "@/lib/queries/clases.queries";
import { updateClasesMaxNoshows } from "@/lib/queries/gyms.queries";
import { generarSesionesPara } from "@/lib/utils/clases-generador";
import { claseInputSchema } from "@/lib/validations/clases.schema";
import { hoyISO } from "@/lib/utils/dates";
import type { ClaseInput } from "@/lib/types/clases";

export interface ClaseActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  sesionesGeneradas?: number;
  activa?: boolean;
  /** Aviso no bloqueante (ej. sesiones futuras con reservas que no se tocaron). */
  advertencia?: string;
}

/** Guarda el máximo de no-shows antes de bloquear reservas (C1). */
export const updateNoShowPenaltyAction = panelAction(
  "config.clases_noshow",
  {},
  async (tenant, max: number): Promise<{ ok: boolean; error?: string }> => {
    const n = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
    const r = await updateClasesMaxNoshows(tenant.id, n);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/configuracion/clases`);
    return { ok: true };
  }
);

function buildFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function toClaseInput(v: z.infer<typeof claseInputSchema>): ClaseInput {
  return {
    nombre: v.nombre,
    tipo: v.tipo,
    instructor: v.instructor ? v.instructor : null,
    color: v.color,
    duracion_minutos: v.duracion_minutos,
    cupo_maximo: v.cupo_maximo,
    es_recurrente: v.es_recurrente,
    dias_semana: v.es_recurrente ? v.dias_semana : [],
    hora_inicio: v.hora_inicio,
    fecha_inicio: v.fecha_inicio,
    fecha_fin: v.fecha_fin ? v.fecha_fin : null,
  };
}

export const createClaseAction = panelAction(
  "config.clase_crear",
  {},
  async (tenant, data: unknown): Promise<ClaseActionResult> => {
    const parsed = claseInputSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, fieldErrors: buildFieldErrors(parsed.error) };
    }

    const { clase, error } = await createClase(tenant.id, toClaseInput(parsed.data));
    if (!clase) return { ok: false, error: error ?? "No se pudo crear la clase." };

    // Genera sesiones para las próximas 4 semanas (recurrente) o la única.
    const sesiones = generarSesionesPara(clase, 4);
    const { insertadas } = await insertSesiones(tenant.id, sesiones);

    revalidatePath(`/${tenant.slug}/configuracion/clases`);
    return { ok: true, sesionesGeneradas: insertadas };
  }
);

export const updateClaseAction = panelAction(
  "config.clase_editar",
  {},
  async (tenant, claseId: string, data: unknown): Promise<ClaseActionResult> => {
    const parsed = claseInputSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, fieldErrors: buildFieldErrors(parsed.error) };
    }

    const claseAntes = await getClaseById(tenant.id, claseId);

    const { ok, error } = await updateClase(
      tenant.id,
      claseId,
      toClaseInput(parsed.data)
    );
    if (!ok) return { ok: false, error };

    // Si cambió el horario, las sesiones futuras ya generadas con la hora
    // vieja quedan obsoletas y la próxima regeneración las duplicaría en
    // vez de reemplazarlas — limpiar las que nadie reservó, avisar de las
    // que sí tienen gente (esas no se tocan solas).
    let advertencia: string | undefined;
    if (claseAntes && claseAntes.hora_inicio !== parsed.data.hora_inicio) {
      const { conReservas } = await limpiarSesionesFuturasSinReservas(
        tenant.id,
        claseId,
        hoyISO()
      );
      if (conReservas > 0) {
        advertencia = `Cambiaste el horario, pero ${conReservas} sesión${conReservas === 1 ? "" : "es"} futura${conReservas === 1 ? "" : "s"} ya tiene reservas y se quedó con el horario anterior. Revísalas y cancélalas a mano si hace falta.`;
      }
    }

    revalidatePath(`/${tenant.slug}/configuracion/clases`);
    return { ok: true, advertencia };
  }
);

export const toggleClaseActivaAction = panelAction(
  "config.clase_toggle",
  {},
  async (tenant, claseId: string): Promise<ClaseActionResult> => {
    const { ok, activa, error } = await toggleClaseActiva(tenant.id, claseId);
    if (!ok) return { ok: false, error };

    revalidatePath(`/${tenant.slug}/configuracion/clases`);
    return { ok: true, activa };
  }
);

export const generarSesionesAction = panelAction(
  "config.clase_generar_sesiones",
  {},
  async (tenant, claseId: string, semanas: number = 4): Promise<ClaseActionResult> => {
    const clase = await getClaseById(tenant.id, claseId);
    if (!clase) return { ok: false, error: "Clase no encontrada." };

    const sesiones = generarSesionesPara(clase, semanas);
    const { insertadas, error } = await insertSesiones(tenant.id, sesiones);
    if (error) return { ok: false, error };

    revalidatePath(`/${tenant.slug}/configuracion/clases`);
    return { ok: true, sesionesGeneradas: insertadas };
  }
);
