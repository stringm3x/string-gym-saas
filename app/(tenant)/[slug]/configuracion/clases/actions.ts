"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { hasFeature } from "@/lib/features";
import {
  createClase,
  updateClase,
  toggleClaseActiva,
  getClaseById,
  insertSesiones,
} from "@/lib/queries/clases.queries";
import { updateClasesMaxNoshows } from "@/lib/queries/gyms.queries";
import { generarSesionesPara } from "@/lib/utils/clases-generador";
import { claseInputSchema } from "@/lib/validations/clases.schema";
import type { ClaseInput } from "@/lib/types/clases";

export interface ClaseActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  sesionesGeneradas?: number;
  activa?: boolean;
}

const DENIED: ClaseActionResult = { ok: false, error: "No autorizado." };

/** Guarda el máximo de no-shows antes de bloquear reservas (C1). */
export async function updateNoShowPenaltyAction(
  max: number
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await gate();
  if (!tenant) return { ok: false, error: "No autorizado." };

  const n = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
  const r = await updateClasesMaxNoshows(tenant.id, n);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/configuracion/clases`);
  return { ok: true };
}

/** Owner + feature 'clases' (Pro+). */
async function gate() {
  const tenant = await getTenant();
  if (
    !hasPermission(tenant.role, "configurar_general") ||
    !hasFeature(tenant.plan, "clases")
  ) {
    return null;
  }
  return tenant;
}

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

export async function createClaseAction(
  data: unknown
): Promise<ClaseActionResult> {
  const tenant = await gate();
  if (!tenant) return DENIED;

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

export async function updateClaseAction(
  claseId: string,
  data: unknown
): Promise<ClaseActionResult> {
  const tenant = await gate();
  if (!tenant) return DENIED;

  const parsed = claseInputSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, fieldErrors: buildFieldErrors(parsed.error) };
  }

  // No regenera sesiones: solo actualiza los datos de la clase.
  const { ok, error } = await updateClase(
    tenant.id,
    claseId,
    toClaseInput(parsed.data)
  );
  if (!ok) return { ok: false, error };

  revalidatePath(`/${tenant.slug}/configuracion/clases`);
  return { ok: true };
}

export async function toggleClaseActivaAction(
  claseId: string
): Promise<ClaseActionResult> {
  const tenant = await gate();
  if (!tenant) return DENIED;

  const { ok, activa, error } = await toggleClaseActiva(tenant.id, claseId);
  if (!ok) return { ok: false, error };

  revalidatePath(`/${tenant.slug}/configuracion/clases`);
  return { ok: true, activa };
}

export async function generarSesionesAction(
  claseId: string,
  semanas = 4
): Promise<ClaseActionResult> {
  const tenant = await gate();
  if (!tenant) return DENIED;

  const clase = await getClaseById(tenant.id, claseId);
  if (!clase) return { ok: false, error: "Clase no encontrada." };

  const sesiones = generarSesionesPara(clase, semanas);
  const { insertadas, error } = await insertSesiones(tenant.id, sesiones);
  if (error) return { ok: false, error };

  revalidatePath(`/${tenant.slug}/configuracion/clases`);
  return { ok: true, sesionesGeneradas: insertadas };
}
