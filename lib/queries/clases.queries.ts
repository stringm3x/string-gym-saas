import { createClient } from "@/lib/supabase/server";
import type {
  Clase,
  ClaseInput,
  ClaseReserva,
  ClaseSesion,
  ReservaInput,
  SesionToCreate,
} from "@/lib/types/clases";

const CLASE_COLS =
  "id, tenant_id, nombre, descripcion, instructor, color, tipo, duracion_minutos, cupo_maximo, es_recurrente, dias_semana, hora_inicio, fecha_inicio, fecha_fin, activa, created_at";

// ─────────────────────────────── Clases ───────────────────────────────

export async function getClases(
  tenantId: string,
  includeInactive = false
): Promise<Clase[]> {
  const supabase = await createClient();
  let query = supabase
    .from("clases")
    .select(CLASE_COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (!includeInactive) query = query.eq("activa", true);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Clase[];
}

export async function getClaseById(
  tenantId: string,
  claseId: string
): Promise<Clase | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases")
    .select(CLASE_COLS)
    .eq("tenant_id", tenantId)
    .eq("id", claseId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Clase;
}

export async function createClase(
  tenantId: string,
  input: ClaseInput
): Promise<{ clase: Clase | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases")
    .insert({
      tenant_id: tenantId,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      instructor: input.instructor ?? null,
      color: input.color ?? "#10b981",
      tipo: input.tipo,
      duracion_minutos: input.duracion_minutos,
      cupo_maximo: input.cupo_maximo,
      es_recurrente: input.es_recurrente,
      dias_semana: input.dias_semana,
      hora_inicio: input.hora_inicio,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin ?? null,
    })
    .select(CLASE_COLS)
    .single();
  if (error || !data) return { clase: null, error: error?.message };
  return { clase: data as Clase };
}

export async function updateClase(
  tenantId: string,
  claseId: string,
  input: Partial<ClaseInput>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clases")
    .update({
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.descripcion !== undefined && { descripcion: input.descripcion }),
      ...(input.instructor !== undefined && { instructor: input.instructor }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.tipo !== undefined && { tipo: input.tipo }),
      ...(input.duracion_minutos !== undefined && {
        duracion_minutos: input.duracion_minutos,
      }),
      ...(input.cupo_maximo !== undefined && { cupo_maximo: input.cupo_maximo }),
      ...(input.es_recurrente !== undefined && {
        es_recurrente: input.es_recurrente,
      }),
      ...(input.dias_semana !== undefined && { dias_semana: input.dias_semana }),
      ...(input.hora_inicio !== undefined && { hora_inicio: input.hora_inicio }),
      ...(input.fecha_inicio !== undefined && {
        fecha_inicio: input.fecha_inicio,
      }),
      ...(input.fecha_fin !== undefined && { fecha_fin: input.fecha_fin }),
    })
    .eq("tenant_id", tenantId)
    .eq("id", claseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleClaseActiva(
  tenantId: string,
  claseId: string
): Promise<{ ok: boolean; activa?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("clases")
    .select("activa")
    .eq("tenant_id", tenantId)
    .eq("id", claseId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Clase no encontrada." };

  const nueva = !current.activa;
  const { error } = await supabase
    .from("clases")
    .update({ activa: nueva })
    .eq("tenant_id", tenantId)
    .eq("id", claseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, activa: nueva };
}

// ─────────────────────────────── Sesiones ───────────────────────────────

const SESION_COLS =
  "id, tenant_id, clase_id, fecha, hora_inicio, hora_fin, cupo_maximo, cupo_disponible, estado, notas";

export async function getSesionesByRango(
  tenantId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<ClaseSesion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases_sesiones")
    .select(
      `${SESION_COLS}, clase:clases(nombre, color, instructor, tipo)`
    )
    .eq("tenant_id", tenantId)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true });
  if (error || !data) return [];
  return data as unknown as ClaseSesion[];
}

export async function getSesionById(
  tenantId: string,
  sesionId: string
): Promise<ClaseSesion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases_sesiones")
    .select(
      `${SESION_COLS}, clase:clases(nombre, color, instructor, tipo),
       reservas:clases_reservas(
         id, tenant_id, sesion_id, miembro_id, prospecto_id,
         nombre_visitante, telefono_visitante, estado, check_in_at,
         check_in_by, origen, created_at,
         miembro:miembros(nombre, telefono),
         prospecto:prospectos(nombre, telefono)
       )`
    )
    .eq("tenant_id", tenantId)
    .eq("id", sesionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ClaseSesion;
}

/**
 * Inserta sesiones generadas (la computación de fechas la hace el generador
 * del Bloque 2). Ignora colisiones con el unique (clase_id, fecha, hora_inicio)
 * para que regenerar sea idempotente. Devuelve cuántas se insertaron.
 */
export async function insertSesiones(
  tenantId: string,
  sesiones: SesionToCreate[]
): Promise<{ insertadas: number; error?: string }> {
  if (sesiones.length === 0) return { insertadas: 0 };
  const supabase = await createClient();
  const rows = sesiones.map((s) => ({
    tenant_id: tenantId,
    clase_id: s.clase_id,
    fecha: s.fecha,
    hora_inicio: s.hora_inicio,
    hora_fin: s.hora_fin,
    cupo_maximo: s.cupo_maximo,
    cupo_disponible: s.cupo_disponible,
  }));
  const { data, error } = await supabase
    .from("clases_sesiones")
    .upsert(rows, {
      onConflict: "clase_id,fecha,hora_inicio",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) return { insertadas: 0, error: error.message };
  return { insertadas: data?.length ?? 0 };
}

export async function cancelarSesion(
  tenantId: string,
  sesionId: string,
  motivo?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clases_sesiones")
    .update({ estado: "cancelada", notas: motivo ?? null })
    .eq("tenant_id", tenantId)
    .eq("id", sesionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────── Reservas ───────────────────────────────

const RESERVA_COLS =
  "id, tenant_id, sesion_id, miembro_id, prospecto_id, nombre_visitante, telefono_visitante, estado, check_in_at, check_in_by, origen, created_at";

export async function getReservasBySesion(
  tenantId: string,
  sesionId: string
): Promise<ClaseReserva[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases_reservas")
    .select(
      `${RESERVA_COLS}, miembro:miembros(nombre, telefono), prospecto:prospectos(nombre, telefono)`
    )
    .eq("tenant_id", tenantId)
    .eq("sesion_id", sesionId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as unknown as ClaseReserva[];
}

export async function getReservasByMiembro(
  tenantId: string,
  miembroId: string
): Promise<ClaseReserva[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases_reservas")
    .select(
      `${RESERVA_COLS}, sesion:clases_sesiones(fecha, hora_inicio, clase:clases(nombre, color))`
    )
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as ClaseReserva[];
}

/**
 * Crea una reserva respetando el cupo: si hay cupo_disponible la deja
 * 'confirmada', si no, en 'en_lista_espera'. Si la persona (miembro/prospecto)
 * ya tenía una reserva CANCELADA en la sesión, la reactiva en vez de insertar
 * (el unique (sesion_id, miembro_id) no distingue estado).
 *
 * La creación de prospecto para clases 'gratis' y la promoción de lista de
 * espera viven en utils del Bloque 2 que envuelven a esta query.
 */
export async function createReserva(
  tenantId: string,
  sesionId: string,
  input: ReservaInput
): Promise<{ reserva: ClaseReserva | null; enListaEspera: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: sesion } = await supabase
    .from("clases_sesiones")
    .select("cupo_disponible, estado")
    .eq("tenant_id", tenantId)
    .eq("id", sesionId)
    .maybeSingle();
  if (!sesion) {
    return { reserva: null, enListaEspera: false, error: "Sesión no encontrada." };
  }
  if (sesion.estado === "cancelada") {
    return { reserva: null, enListaEspera: false, error: "La sesión está cancelada." };
  }

  const enListaEspera = sesion.cupo_disponible <= 0;
  const estado = enListaEspera ? "en_lista_espera" : "confirmada";
  const origen = input.origen ?? "manual";

  // Reactivación si ya existía una reserva cancelada de la misma persona.
  if (input.miembroId || input.prospectoId) {
    const col = input.miembroId ? "miembro_id" : "prospecto_id";
    const val = input.miembroId ?? input.prospectoId!;
    const { data: existing } = await supabase
      .from("clases_reservas")
      .select("id, estado")
      .eq("tenant_id", tenantId)
      .eq("sesion_id", sesionId)
      .eq(col, val)
      .maybeSingle();

    if (existing) {
      if (existing.estado !== "cancelada") {
        return {
          reserva: null,
          enListaEspera: false,
          error: "Esta persona ya tiene una reserva en la sesión.",
        };
      }
      const { data: upd, error: updErr } = await supabase
        .from("clases_reservas")
        .update({ estado, origen })
        .eq("id", existing.id)
        .select(RESERVA_COLS)
        .single();
      if (updErr || !upd) {
        return { reserva: null, enListaEspera, error: updErr?.message };
      }
      return { reserva: upd as ClaseReserva, enListaEspera };
    }
  }

  const { data: ins, error } = await supabase
    .from("clases_reservas")
    .insert({
      tenant_id: tenantId,
      sesion_id: sesionId,
      miembro_id: input.miembroId ?? null,
      prospecto_id: input.prospectoId ?? null,
      nombre_visitante: input.nombreVisitante ?? null,
      telefono_visitante: input.telefonoVisitante ?? null,
      estado,
      origen,
    })
    .select(RESERVA_COLS)
    .single();
  if (error || !ins) return { reserva: null, enListaEspera, error: error?.message };
  return { reserva: ins as ClaseReserva, enListaEspera };
}

/**
 * Cancela una reserva. Devuelve la sesion_id para que el caller (Bloque 2)
 * pueda promover la lista de espera de esa sesión.
 */
export async function cancelarReserva(
  tenantId: string,
  reservaId: string
): Promise<{ ok: boolean; sesionId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases_reservas")
    .update({ estado: "cancelada" })
    .eq("tenant_id", tenantId)
    .eq("id", reservaId)
    .select("sesion_id")
    .single();
  if (error || !data) return { ok: false, error: error?.message };
  return { ok: true, sesionId: data.sesion_id };
}

export async function checkInReserva(
  tenantId: string,
  reservaId: string,
  adminUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clases_reservas")
    .update({
      estado: "asistio",
      check_in_at: new Date().toISOString(),
      check_in_by: adminUserId,
    })
    .eq("tenant_id", tenantId)
    .eq("id", reservaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────── Helpers para utils del Bloque 2 (cupo / lista-espera / prospecto) ───────────

/** Confirma una reserva (promoción de lista de espera). */
export async function confirmarReserva(
  tenantId: string,
  reservaId: string
): Promise<{ reserva: ClaseReserva | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases_reservas")
    .update({ estado: "confirmada" })
    .eq("tenant_id", tenantId)
    .eq("id", reservaId)
    .select(RESERVA_COLS)
    .single();
  if (error || !data) return { reserva: null, error: error?.message };
  return { reserva: data as ClaseReserva };
}

/** Linkea una reserva con el prospecto creado desde una clase gratis. */
export async function setReservaProspecto(
  tenantId: string,
  reservaId: string,
  prospectoId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("clases_reservas")
    .update({ prospecto_id: prospectoId })
    .eq("tenant_id", tenantId)
    .eq("id", reservaId);
}

/** Busca un miembro por teléfono (para no duplicar como prospecto). */
export async function findMiembroByTelefono(
  tenantId: string,
  telefono: string
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembros")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("telefono", telefono)
    .limit(1);
  return data?.[0] ?? null;
}

/** Inserta un prospecto con origen 'clase_gratis' (requiere migración 025). */
export async function createProspectoClaseGratis(
  tenantId: string,
  input: { nombre: string; telefono: string; nota: string }
): Promise<{ id: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospectos")
    .insert({
      tenant_id: tenantId,
      nombre: input.nombre,
      telefono: input.telefono,
      origen: "clase_gratis",
      estado: "nuevo",
      notas: input.nota,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message };
  return { id: data.id };
}
