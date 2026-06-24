import {
  findMiembroByTelefono,
  createProspectoClaseGratis,
  setReservaProspecto,
} from "@/lib/queries/clases.queries";
import type { Clase, ClaseReserva } from "@/lib/types/clases";

interface ReservanteData {
  nombre?: string | null;
  telefono?: string | null;
}

/**
 * Si la clase es de tipo 'gratis' y el reservante dio nombre + teléfono y NO es
 * ya un miembro (match por teléfono), crea un prospecto (origen 'clase_gratis',
 * estado 'nuevo') y lo linkea a la reserva. Devuelve el id del prospecto o null
 * si no aplica.
 *
 * Requiere la migración 025 (origen 'clase_gratis' permitido en prospectos).
 */
export async function crearProspectoDesdeClaseGratis(
  tenantId: string,
  clase: Pick<Clase, "tipo" | "nombre">,
  reserva: Pick<ClaseReserva, "id">,
  data: ReservanteData,
  fecha: string
): Promise<string | null> {
  if (clase.tipo !== "gratis") return null;

  const nombre = data.nombre?.trim();
  const telefono = data.telefono?.trim();
  if (!nombre || !telefono) return null;

  // No duplicar: si el teléfono ya es de un miembro, no se crea prospecto.
  const miembro = await findMiembroByTelefono(tenantId, telefono);
  if (miembro) return null;

  const nota = `Reservó clase gratis: ${clase.nombre} el ${fecha}`;
  const { id } = await createProspectoClaseGratis(tenantId, {
    nombre,
    telefono,
    nota,
  });
  if (!id) return null;

  await setReservaProspecto(tenantId, reserva.id, id);
  return id;
}
