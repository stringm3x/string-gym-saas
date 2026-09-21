import { z } from "zod";

/** Frecuencia con la que vencen las cuotas. */
export const frecuenciaCuotaEnum = z.enum(["semanal", "quincenal", "mensual"]);
export type FrecuenciaCuota = z.infer<typeof frecuenciaCuotaEnum>;

/** Días entre cuotas según la frecuencia. */
export const DIAS_FRECUENCIA: Record<FrecuenciaCuota, number> = {
  semanal: 7,
  quincenal: 15,
  mensual: 30,
};

/** Un plan a plazos es de membresía o de producto del inventario. */
export const tipoPlanPagoEnum = z.enum(["membresia", "producto"]);
export type TipoPlanPago = z.infer<typeof tipoPlanPagoEnum>;

/** Mismos 3 métodos que el resto de caja/créditos. */
export const metodoPagoEnum = z.enum(["efectivo", "tarjeta", "transferencia"]);
export type MetodoPago = z.infer<typeof metodoPagoEnum>;

export const planPagoInputSchema = z
  .object({
    miembro_id: z.string().uuid("Selecciona un miembro"),
    tipo: tipoPlanPagoEnum,
    plan_membresia_id: z.string().uuid().optional(),
    producto_id: z.string().uuid().optional(),
    cantidad: z.number().int().min(1).max(999).optional(),
    // El total NO viaja del cliente: se calcula server-side del precio real
    // del plan/producto seleccionado (createPlanPago). Antes era un campo
    // libre que el staff podía escribir sin relación con lo que costaba lo
    // que se estaba financiando.
    cuotas: z
      .number({ error: "Número de cuotas inválido" })
      .int()
      .min(2, "Mínimo 2 cuotas")
      .max(12, "Máximo 12 cuotas"),
    concepto: z.string().max(200).optional(),
    frecuencia: frecuenciaCuotaEnum.default("quincenal"),
    metodo: metodoPagoEnum.default("efectivo"),
  })
  .refine(
    (d) => d.tipo !== "membresia" || !!d.plan_membresia_id,
    { error: "Selecciona un plan de membresía", path: ["plan_membresia_id"] }
  )
  .refine((d) => d.tipo !== "producto" || !!d.producto_id, {
    error: "Selecciona un producto",
    path: ["producto_id"],
  });

export type PlanPagoInput = z.infer<typeof planPagoInputSchema>;
