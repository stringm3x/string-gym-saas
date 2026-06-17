"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import {
  createMiembro as dbCreateMiembro,
  updateMiembro as dbUpdateMiembro,
  updateMiembroNotas as dbUpdateMiembroNotas,
  archivarMiembro as dbArchivarMiembro,
  restaurarMiembro as dbRestaurarMiembro,
} from "@/lib/queries/miembros.queries";
import { createPago } from "@/lib/queries/pagos.queries";
import {
  miembroSchema,
  miembroConPagoSchema,
} from "@/lib/validations/miembro.schema";
import { updateEstadoProspecto } from "@/lib/queries/prospectos.queries";
import {
  syncTagsForMiembro,
  bulkAddTagToMiembros,
} from "@/lib/queries/tags.queries";

export interface MiembroFormState {
  ok: boolean;
  error: string | null;
  /**
   * Errores por campo (Zod) — para mostrar inline en el form.
   */
  fieldErrors: Partial<Record<string, string>>;
  /** Devuelto al crear — para navegación client-side. */
  miembroId?: string;
  /** Devuelto si se cobró la inscripción — para abrir el recibo. */
  pagoId?: string;
}

const emptyState: MiembroFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

function parseFormData(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    email: String(formData.get("email") ?? ""),
    fecha_inscripcion: String(formData.get("fecha_inscripcion") ?? ""),
    fecha_vencimiento: String(formData.get("fecha_vencimiento") ?? ""),
    prospecto_id: String(formData.get("prospecto_id") ?? ""),
    tag_ids: formData.getAll("tag_ids").map(String),
  };
}

export async function createMiembroAction(
  _prev: MiembroFormState,
  formData: FormData
): Promise<MiembroFormState> {
  const tenant = await getTenant();
  const raw = parseFormData(formData);
  const { prospecto_id, tag_ids, ...miembroRaw } = raw;

  const montoRaw = formData.get("monto_pago");
  const cobroRaw = {
    ...miembroRaw,
    cobrar_inscripcion: formData.get("cobrar_inscripcion") === "true",
    plan_id: String(formData.get("plan_id") ?? ""),
    promocion_id: String(formData.get("promocion_id") ?? ""),
    monto_pago:
      montoRaw && String(montoRaw).trim() ? Number(montoRaw) : undefined,
    metodo_pago: (formData.get("metodo_pago") || undefined) as
      | "efectivo"
      | "tarjeta"
      | "transferencia"
      | undefined,
    periodo_inicio: String(formData.get("periodo_inicio") ?? ""),
    periodo_fin: String(formData.get("periodo_fin") ?? ""),
  };

  const parsed = miembroConPagoSchema.safeParse(cobroRaw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const data = parsed.data;

  // 1. Crear miembro (solo campos base).
  const result = await dbCreateMiembro(tenant.id, {
    nombre: data.nombre,
    telefono: data.telefono,
    email: data.email,
    fecha_inscripcion: data.fecha_inscripcion,
    fecha_vencimiento: data.fecha_vencimiento,
  });
  if (!result.ok) {
    return { ...emptyState, error: result.error };
  }

  await syncTagsForMiembro(tenant.id, result.id, tag_ids);

  // 2. Cobro de la primera membresía (opcional). createPago también
  //    actualiza la fecha_vencimiento del miembro a periodo_fin.
  let pagoId: string | undefined;
  if (data.cobrar_inscripcion && data.monto_pago && data.metodo_pago) {
    const pagoResult = await createPago(tenant.id, {
      miembro_id: result.id,
      concepto: "membresia",
      monto: data.monto_pago,
      metodo_pago: data.metodo_pago,
      periodo_inicio: data.periodo_inicio || "",
      periodo_fin: data.periodo_fin || "",
      plan_id: data.plan_id || "",
      promocion_id: data.promocion_id || "",
      producto_id: "",
      cantidad_producto: null,
    });
    if (pagoResult.ok) {
      pagoId = pagoResult.id;
      revalidatePath(`/${tenant.slug}/caja`);
    }
  }

  // 3. Si venía de prospecto, marcar como convertido.
  if (prospecto_id) {
    await updateEstadoProspecto(tenant.id, prospecto_id, "convertido");
    revalidatePath(`/${tenant.slug}/prospectos`);
  }

  revalidatePath(`/${tenant.slug}/miembros`);
  return {
    ok: true,
    error: null,
    fieldErrors: {},
    miembroId: result.id,
    pagoId,
  };
}

export async function updateMiembroAction(
  id: string,
  _prev: MiembroFormState,
  formData: FormData
): Promise<MiembroFormState> {
  const tenant = await getTenant();
  const raw = parseFormData(formData);
  const { tag_ids, prospecto_id: _pid, ...miembroRaw } = raw;

  const parsed = miembroSchema.safeParse(miembroRaw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const result = await dbUpdateMiembro(tenant.id, id, parsed.data);
  if (!result.ok) {
    return { ...emptyState, error: result.error };
  }

  await syncTagsForMiembro(tenant.id, id, tag_ids);

  revalidatePath(`/${tenant.slug}/miembros`);
  revalidatePath(`/${tenant.slug}/miembros/${id}`);
  return { ok: true, error: null, fieldErrors: {} };
}

export async function updateNotasLegacyAction(
  id: string,
  notas: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  const result = await dbUpdateMiembroNotas(tenant.id, id, notas);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/${tenant.slug}/miembros/${id}`);
  return { ok: true };
}

export async function archivarMiembroAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  const result = await dbArchivarMiembro(tenant.id, id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/${tenant.slug}/miembros`);
  revalidatePath(`/${tenant.slug}/miembros/${id}`);
  return { ok: true };
}

export async function restaurarMiembroAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  const result = await dbRestaurarMiembro(tenant.id, id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/${tenant.slug}/miembros`);
  revalidatePath(`/${tenant.slug}/miembros/${id}`);
  return { ok: true };
}

export async function bulkAsignarTagAction(
  miembroIds: string[],
  tagId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!miembroIds.length || !tagId)
    return { ok: false, error: "Faltan datos." };
  const tenant = await getTenant();
  const result = await bulkAddTagToMiembros(tenant.id, miembroIds, tagId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/${tenant.slug}/miembros`);
  return { ok: true };
}
