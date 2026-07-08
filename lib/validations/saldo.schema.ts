import { z } from "zod";

const montoPositivo = z
  .number({ error: "Monto inválido" })
  .positive("El monto debe ser mayor a 0")
  .max(1_000_000, "Monto demasiado alto");

const concepto = z.string().min(1, "Escribe un concepto").max(200);

export const recargaSaldoSchema = z.object({
  monto: montoPositivo,
  concepto,
});
export type RecargaSaldoInput = z.infer<typeof recargaSaldoSchema>;

export const consumoSaldoSchema = z.object({
  monto: montoPositivo,
  concepto,
});
export type ConsumoSaldoInput = z.infer<typeof consumoSaldoSchema>;

/** Ajuste manual: el monto puede ser negativo (corrección hacia abajo). */
export const ajusteSaldoSchema = z.object({
  monto: z
    .number({ error: "Monto inválido" })
    .refine((n) => n !== 0, "El ajuste no puede ser 0")
    .refine((n) => Math.abs(n) <= 1_000_000, "Monto demasiado alto"),
  concepto,
});
export type AjusteSaldoInput = z.infer<typeof ajusteSaldoSchema>;
