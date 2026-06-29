import { z } from "zod";

/** Body de POST /api/solicitudes (desde el form público de stringwebs.com). */
export const solicitudSchema = z.object({
  nombre: z.string().trim().min(1, { error: "Nombre requerido." }).max(120),
  email: z.string().trim().email({ error: "Email inválido." }),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
  nombre_gym: z.string().trim().max(120).optional().or(z.literal("")),
  plan_interes: z.enum(["basico", "pro", "escala"]).optional(),
  ciudad: z.string().trim().max(120).optional().or(z.literal("")),
  // El form envía un número representativo del rango (<50→25, 50-150→100, …).
  miembros_aprox: z.coerce.number().int().min(0).max(100000).optional(),
  como_entero: z.string().trim().max(200).optional().or(z.literal("")),
  notas: z.string().trim().max(1000).optional().or(z.literal("")),
  turnstile_token: z.string().min(1, { error: "Verificación requerida." }),
});

export type SolicitudInput = z.infer<typeof solicitudSchema>;
