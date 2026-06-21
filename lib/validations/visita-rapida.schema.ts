import { z } from "zod";
import { metodoPagoEnum } from "./pago.schema";

export const visitaRapidaSchema = z.object({
  nombre_visitante: z
    .string()
    .trim()
    .min(2, { error: "Nombre requerido" })
    .max(120, { error: "Nombre demasiado largo" }),
  telefono_visitante: z
    .string()
    .trim()
    .max(20, { error: "Teléfono inválido" })
    .optional()
    .or(z.literal("")),
  monto: z
    .number({ error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0")
    .max(1_000_000, "Monto demasiado alto"),
  metodo_pago: metodoPagoEnum,
});

export type VisitaRapidaInput = z.infer<typeof visitaRapidaSchema>;
