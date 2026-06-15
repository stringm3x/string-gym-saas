"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { createPago } from "@/lib/queries/pagos.queries";
import { pagoSchema } from "@/lib/validations/pago.schema";

export interface PagoResult {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export async function registerPagoAction(
  _prev: PagoResult,
  formData: FormData
): Promise<PagoResult> {
  const tenant = await getTenant();

  const raw = {
    miembro_id: String(formData.get("miembro_id") ?? ""),
    concepto: String(formData.get("concepto") ?? "membresia") as
      | "membresia"
      | "visita"
      | "producto"
      | "otro",
    monto: Number(formData.get("monto") ?? 0),
    metodo_pago: String(formData.get("metodo_pago") ?? "efectivo") as
      | "efectivo"
      | "tarjeta"
      | "transferencia",
    periodo_inicio: String(formData.get("periodo_inicio") ?? ""),
    periodo_fin: String(formData.get("periodo_fin") ?? ""),
    plan_id: String(formData.get("plan_id") ?? ""),
    promocion_id: String(formData.get("promocion_id") ?? ""),
  };

  const parsed = pagoSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const result = await createPago(tenant.id, parsed.data);

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: {} };
  }

  revalidatePath(`/${tenant.slug}/caja`);
  revalidatePath(`/${tenant.slug}/miembros`);
  if (parsed.data.miembro_id) {
    revalidatePath(`/${tenant.slug}/miembros/${parsed.data.miembro_id}`);
  }

  return { ok: true, error: null, fieldErrors: {} };
}
