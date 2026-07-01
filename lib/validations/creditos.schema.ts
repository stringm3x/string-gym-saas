import { z } from "zod";

/** Frecuencia con la que vencen las cuotas. */
export const frecuenciaCuotaEnum = z.enum(["quincenal", "mensual"]);
export type FrecuenciaCuota = z.infer<typeof frecuenciaCuotaEnum>;

/** Días entre cuotas según la frecuencia. */
export const DIAS_FRECUENCIA: Record<FrecuenciaCuota, number> = {
  quincenal: 15,
  mensual: 30,
};

export const planPagoInputSchema = z.object({
  miembro_id: z.string().uuid("Selecciona un miembro"),
  plan_membresia_id: z.string().uuid("Selecciona un plan de membresía"),
  total: z
    .number({ error: "Monto inválido" })
    .positive("El total debe ser mayor a 0")
    .max(1_000_000, "Monto demasiado alto"),
  cuotas: z
    .number({ error: "Número de cuotas inválido" })
    .int()
    .min(2, "Mínimo 2 cuotas")
    .max(12, "Máximo 12 cuotas"),
  concepto: z.string().max(200).optional(),
  frecuencia: frecuenciaCuotaEnum.default("quincenal"),
});

export type PlanPagoInput = z.infer<typeof planPagoInputSchema>;
