import { z } from "zod";

export const inviteStaffSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ error: "Correo inválido" }),
  nombre: z
    .string()
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 caracteres" })
    .max(80, { error: "El nombre es demasiado largo" }),
});

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const acceptInviteSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 caracteres" })
    .max(80, { error: "El nombre es demasiado largo" }),
  password: z
    .string()
    .min(8, { error: "La contraseña debe tener al menos 8 caracteres" })
    .max(72, { error: "La contraseña es demasiado larga" }),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
