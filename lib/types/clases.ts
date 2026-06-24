export type ClaseTipo = "regular" | "gratis" | "taller" | "privada";
export type SesionEstado =
  | "programada"
  | "en_curso"
  | "completada"
  | "cancelada";
export type ReservaEstado =
  | "confirmada"
  | "en_lista_espera"
  | "cancelada"
  | "asistio"
  | "no_asistio";
export type ReservaOrigen = "manual" | "api" | "portal";

export interface Clase {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion: string | null;
  instructor: string | null;
  color: string;
  tipo: ClaseTipo;
  duracion_minutos: number;
  cupo_maximo: number;
  es_recurrente: boolean;
  dias_semana: number[];
  hora_inicio: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  activa: boolean;
  created_at: string;
}

export interface ClaseSesion {
  id: string;
  tenant_id: string;
  clase_id: string;
  clase?: Pick<Clase, "nombre" | "color" | "instructor" | "tipo"> | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  cupo_disponible: number;
  estado: SesionEstado;
  notas: string | null;
  reservas?: ClaseReserva[];
}

export interface ClaseReserva {
  id: string;
  tenant_id: string;
  sesion_id: string;
  miembro_id: string | null;
  prospecto_id: string | null;
  nombre_visitante: string | null;
  telefono_visitante: string | null;
  estado: ReservaEstado;
  check_in_at: string | null;
  check_in_by: string | null;
  origen: ReservaOrigen;
  created_at: string;
  miembro?: { nombre: string; telefono: string | null } | null;
  prospecto?: { nombre: string; telefono: string | null } | null;
}

/** Entrada para crear/editar una clase (sin campos derivados). */
export interface ClaseInput {
  nombre: string;
  descripcion?: string | null;
  instructor?: string | null;
  color?: string;
  tipo: ClaseTipo;
  duracion_minutos: number;
  cupo_maximo: number;
  es_recurrente: boolean;
  dias_semana: number[];
  hora_inicio: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
}

/** Sesión lista para insertar (la computa el generador del Bloque 2). */
export interface SesionToCreate {
  clase_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  cupo_disponible: number;
}

/** Datos de una reserva nueva (la decisión cupo/lista-espera la pone la query). */
export interface ReservaInput {
  miembroId?: string | null;
  prospectoId?: string | null;
  nombreVisitante?: string | null;
  telefonoVisitante?: string | null;
  origen?: ReservaOrigen;
}

/** Reserva con datos de su sesión (para el historial de un miembro). */
export interface ReservaMiembro extends ClaseReserva {
  sesion?: {
    fecha: string;
    hora_inicio: string;
    clase?: { nombre: string; color: string } | null;
  } | null;
}

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
