import { z } from "zod";

export const audienciaEnum = z.enum([
  "todos_activos",
  "por_vencer_7d",
  "por_vencer_30d",
  "vencidos",
  "sin_actividad_14d",
  "prospectos",
]);
export type Audiencia = z.infer<typeof audienciaEnum>;

/** Etiquetas y descripción de cada audiencia (para el selector del wizard). */
export const AUDIENCIAS: {
  value: Audiencia;
  label: string;
  descripcion: string;
}[] = [
  {
    value: "todos_activos",
    label: "Todos los activos",
    descripcion: "Miembros con membresía vigente",
  },
  {
    value: "por_vencer_7d",
    label: "Por vencer en 7 días",
    descripcion: "Vencen dentro de la próxima semana",
  },
  {
    value: "por_vencer_30d",
    label: "Por vencer en 30 días",
    descripcion: "Vencen dentro del próximo mes",
  },
  {
    value: "vencidos",
    label: "Vencidos",
    descripcion: "Membresía vencida (no archivados)",
  },
  {
    value: "sin_actividad_14d",
    label: "Sin actividad 14 días",
    descripcion: "Activos sin check-in en 2 semanas",
  },
  {
    value: "prospectos",
    label: "Prospectos",
    descripcion: "Interesados aún no convertidos",
  },
];

export const campanaInputSchema = z.object({
  nombre: z.string().min(1, "Ponle un nombre a la campaña").max(100),
  mensaje: z
    .string()
    .min(1, "Escribe el mensaje")
    .max(1000, "Máximo 1000 caracteres"),
  audiencia: audienciaEnum,
});

export type CampanaInput = z.infer<typeof campanaInputSchema>;
