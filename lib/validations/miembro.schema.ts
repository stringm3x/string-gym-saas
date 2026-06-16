import { z } from "zod";

/**
 * Objeto base de un miembro — sin refinamientos, para poder extenderlo.
 */
const miembroBaseObject = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(120, "El nombre es demasiado largo"),
  telefono: z
    .string()
    .trim()
    .max(20, "Teléfono inválido")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Correo inválido")
    .optional()
    .or(z.literal("")),
  fecha_inscripcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  fecha_vencimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("")),
});

const requiereContacto = (data: { telefono?: string; email?: string }) =>
  Boolean(data.telefono) || Boolean(data.email);

/**
 * Schema base de un miembro — usado para creación y edición.
 * Telefono y email son opcionales pero al menos uno debe existir
 * (para poder contactarlo).
 */
export const miembroSchema = miembroBaseObject.refine(requiereContacto, {
  message: "Debes capturar al menos teléfono o correo",
  path: ["telefono"],
});

export type MiembroInput = z.infer<typeof miembroSchema>;

/**
 * Schema extendido con cobro de la primera membresía al inscribir.
 * Si `cobrar_inscripcion` es true, se exige monto, método y periodo.
 */
export const miembroConPagoSchema = miembroBaseObject
  .extend({
    cobrar_inscripcion: z.boolean().optional(),
    plan_id: z.string().uuid().optional().or(z.literal("")),
    promocion_id: z.string().uuid().optional().or(z.literal("")),
    monto_pago: z.number().nonnegative().optional(),
    metodo_pago: z
      .enum(["efectivo", "tarjeta", "transferencia"])
      .optional(),
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
  .refine(requiereContacto, {
    message: "Debes capturar al menos teléfono o correo",
    path: ["telefono"],
  })
  .refine(
    (data) => {
      if (!data.cobrar_inscripcion) return true;
      return Boolean(data.monto_pago && data.monto_pago > 0 && data.metodo_pago);
    },
    {
      message: "Define monto y método de pago",
      path: ["monto_pago"],
    }
  )
  .refine(
    (data) => {
      if (!data.cobrar_inscripcion) return true;
      return Boolean(data.periodo_inicio && data.periodo_fin);
    },
    {
      message: "Define el periodo de la membresía",
      path: ["periodo_fin"],
    }
  );

export type MiembroConPagoInput = z.infer<typeof miembroConPagoSchema>;
