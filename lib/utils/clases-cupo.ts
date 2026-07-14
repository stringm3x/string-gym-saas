import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createReserva,
  getReservasBySesion,
  confirmarReserva,
} from "@/lib/queries/clases.queries";
import type {
  ClaseReserva,
  ReservaEstado,
  ReservaInput,
} from "@/lib/types/clases";
import { emitListaEspera } from "@/lib/whatsapp/emit";

/** Regla pura: con cupo libre se confirma; sin cupo, va a lista de espera. */
export function decideEstadoReserva(cupoDisponible: number): ReservaEstado {
  return cupoDisponible > 0 ? "confirmada" : "en_lista_espera";
}

/** Pura: primera reserva en lista de espera por antigüedad (created_at ASC). */
export function primeraEnEspera(reservas: ClaseReserva[]): ClaseReserva | null {
  const espera = reservas
    .filter((r) => r.estado === "en_lista_espera")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return espera[0] ?? null;
}

/**
 * Reserva respetando el cupo. `createReserva` ya aplica la regla
 * (`decideEstadoReserva`) leyendo el cupo en vivo y reactiva canceladas,
 * por eso aquí solo delegamos y devolvemos el flag de lista de espera.
 */
export async function reservarConCupo(
  tenantId: string,
  sesionId: string,
  reservaData: ReservaInput,
  client?: SupabaseClient
): Promise<{
  reserva: ClaseReserva | null;
  enListaEspera: boolean;
  error?: string;
}> {
  return createReserva(tenantId, sesionId, reservaData, client);
}

/**
 * Promueve la primera reserva en lista de espera de una sesión a 'confirmada'.
 * Devuelve la reserva promovida, o null si la lista está vacía.
 *
 * C2: avisa por WhatsApp al promovido (fire-and-forget, dormido sin infra).
 */
export async function promoverListaEspera(
  tenantId: string,
  sesionId: string,
  client?: SupabaseClient
): Promise<ClaseReserva | null> {
  const reservas = await getReservasBySesion(tenantId, sesionId, client);
  const primera = primeraEnEspera(reservas);
  if (!primera) return null;

  const { reserva } = await confirmarReserva(tenantId, primera.id, client);
  const promovida = reserva ?? { ...primera, estado: "confirmada" };

  if (promovida.miembro_id) {
    void emitListaEspera(tenantId, sesionId, promovida.miembro_id);
  }
  return promovida;
}
