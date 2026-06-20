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
