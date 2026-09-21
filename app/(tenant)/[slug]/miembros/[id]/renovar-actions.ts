"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { getMiembro } from "@/lib/queries/miembros.queries";
import { getPlan } from "@/lib/queries/planes.queries";
import { createPago } from "@/lib/queries/pagos.queries";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";

/**
 * Renovación en un clic (B3): cobra el plan indicado (por defecto el plan
 * actual del socio), calculando el periodo con la misma lógica del cobro
 * manual. Reusa createPago (RPC atómico).
 */
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export const renovarMiembroAction = panelAction(
  "miembros.renovar",
  {},
  async (
    tenant,
    miembroId: string,
    planId: string,
    metodo: "efectivo" | "tarjeta" | "transferencia",
    /** Ciclos de facturación fijos (17→17, 20→20…): si se dan, reemplazan el
     *  cálculo automático sin soltar el plan_id. */
    periodoInicio?: string,
    periodoFin?: string
  ): Promise<{ ok: boolean; error?: string; pagoId?: string; reciboError?: string }> => {
    const [miembro, plan] = await Promise.all([
      getMiembro(tenant.id, miembroId),
      getPlan(tenant.id, planId),
    ]);
    if (!miembro) return { ok: false, error: "Miembro no encontrado." };
    if (!plan) return { ok: false, error: "Plan no encontrado." };

    let periodo: { periodo_inicio: string; periodo_fin: string };
    if (periodoInicio && periodoFin) {
      if (!FECHA_RE.test(periodoInicio) || !FECHA_RE.test(periodoFin)) {
        return { ok: false, error: "Fechas inválidas." };
      }
      if (periodoFin < periodoInicio) {
        return { ok: false, error: "La fecha de fin no puede ser antes que la de inicio." };
      }
      periodo = { periodo_inicio: periodoInicio, periodo_fin: periodoFin };
    } else {
      const rango = calcularRangoPorDias(
        plan.dias_duracion,
        miembro.fecha_vencimiento
      );
      periodo = { periodo_inicio: rango.periodo_inicio, periodo_fin: rango.periodo_fin };
    }

    const r = await createPago(tenant.id, {
      miembro_id: miembroId,
      concepto: "membresia",
      monto: plan.precio,
      metodo_pago: metodo,
      plan_id: planId,
      promocion_id: "",
      producto_id: "",
      cantidad_producto: null,
      periodo_inicio: periodo.periodo_inicio,
      periodo_fin: periodo.periodo_fin,
    });
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
    revalidatePath(`/${tenant.slug}/caja`);
    return { ok: true, pagoId: r.id, reciboError: r.reciboError };
  }
);
