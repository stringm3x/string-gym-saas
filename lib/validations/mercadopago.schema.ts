import { z } from "zod";

/** Body del checkout de MercadoPago (Caja → crear preferencia). */
export const checkoutMpSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, { error: "Descripción requerida." })
    .max(200),
  monto: z.coerce
    .number()
    .positive({ error: "El monto debe ser mayor a 0." })
    .max(1_000_000),
  miembroId: z.string().optional(),
  planId: z.string().optional(),
  payerEmail: z
    .string()
    .email({ error: "Email inválido." })
    .optional()
    .or(z.literal("")),
});

export type CheckoutMpInput = z.infer<typeof checkoutMpSchema>;
