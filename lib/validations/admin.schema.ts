import { z } from "zod";

export const cambiarPlanSchema = z.object({
  plan: z.enum(["basico", "pro", "escala"]),
  motivo: z.string().trim().max(300).optional(),
});

export const suspenderSchema = z.object({
  motivo: z.string().trim().min(3, { error: "Indica un motivo." }).max(300),
});

export const cancelarSchema = z.object({
  motivo: z.string().trim().min(3, { error: "Indica un motivo." }).max(300),
  exportar: z.boolean().default(false),
});

export const extenderPruebaSchema = z.object({
  dias: z.coerce
    .number()
    .int()
    .min(1, { error: "Mínimo 1 día." })
    .max(90, { error: "Máximo 90 días." }),
});

export const registrarPagoSchema = z.object({
  concepto: z.enum(["mensualidad", "anualidad", "setup", "migracion", "otro"]),
  monto: z.coerce.number().min(0, { error: "Monto inválido." }),
  metodo: z.enum(["transferencia", "efectivo", "deposito", "otro"]),
  fecha_pago: z.string().min(1, { error: "Fecha requerida." }),
  referencia: z.string().trim().max(120).optional(),
  notas: z.string().trim().max(300).optional(),
});

export const notaSchema = z.object({
  nota: z.string().trim().min(1, { error: "Escribe una nota." }).max(1000),
});

export type CambiarPlanInput = z.infer<typeof cambiarPlanSchema>;
export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;
