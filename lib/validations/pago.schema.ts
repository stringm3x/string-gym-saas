import { z } from "zod";

export const conceptoPagoEnum = z.enum([
  "membresia",
  "visita",
  "producto",
  "otro",
]);
export const metodoPagoEnum = z.enum(["efectivo", "tarjeta", "transferencia"]);

/**
 * Schema base de un pago.
 * - `miembro_id` requerido para membresia y visita; opcional para producto/otro.
 * - `periodo_inicio`/`periodo_fin` solo aplican para membresia.
 */
export const pagoSchema = z
  .object({
    miembro_id: z
      .string()
      .uuid("Selecciona un miembro")
      .optional()
      .or(z.literal("")),
    concepto: conceptoPagoEnum,
    monto: z
      .number({ invalid_type_error: "Monto inválido" })
      .positive("El monto debe ser mayor a 0")
      .max(1_000_000, "Monto demasiado alto"),
    metodo_pago: metodoPagoEnum,
    periodo_inicio: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
    periodo_fin: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.concepto === "membresia" || data.concepto === "visita") {
        return Boolean(data.miembro_id);
      }
      return true;
    },
    {
      message: "Selecciona un miembro para este tipo de pago",
      path: ["miembro_id"],
    }
  )
  .refine(
    (data) => {
      if (data.concepto === "membresia") {
        return Boolean(data.periodo_inicio) && Boolean(data.periodo_fin);
      }
      return true;
    },
    {
      message: "Define el periodo de la membresía",
      path: ["periodo_fin"],
    }
  );

export type PagoInput = z.infer<typeof pagoSchema>;
