import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Staff } from "@/lib/types/staff";

/**
 * Resuelve el staff activo de un usuario en un gym. Usa el client de
 * sesión: la policy "users_can_read_own_staff_record" (migración 012)
 * permite a cada usuario leer su propia fila (user_id = auth.uid()).
 */
export async function getActiveStaff(
  gymId: string,
  userId: string
): Promise<Staff | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("gym_id", gymId)
    .eq("user_id", userId)
    .eq("estado", "activo")
    .maybeSingle();

  if (error || !data) return null;
  return data as Staff;
}

/**
 * Lista todo el staff de un gym (para el manager del owner).
 * Usa el client de sesión: la RLS owner_can_view_staff lo permite.
 *
 * Columnas explícitas (no `select("*")`): este resultado se pasa tal cual a
 * un client component (StaffManager) — si el PIN hash viajara aquí, saldría
 * en el payload RSC hacia el navegador aunque el tipo `Staff` no lo declare.
 */
export async function listStaffByGym(gymId: string): Promise<Staff[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff")
    .select(
      "id, gym_id, user_id, email, nombre, rol, estado, created_at, activado_at, desactivado_at, ultima_sesion_at"
    )
    .eq("gym_id", gymId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as Staff[];
}

// ============================================================
// PIN de check-in (D — quién abre/cierra el turno de caja de verdad,
// no solo qué sesión de Supabase esté activa en la tablet compartida).
//
// Todo aquí usa el admin client (service-role): quien hace el check-in no
// es necesariamente el dueño de la fila `staff` que está verificando (la
// RLS de `staff` solo deja leer/actualizar al owner de su propio gym), así
// que no se puede depender de RLS para este flujo — se acota manualmente
// por `gym_id` en cada query, igual que el OTP del portal de miembros.
// ============================================================

const PIN_MAX_INTENTOS = 5;
const PIN_BLOQUEO_MIN = 10;

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export interface StaffParaCheckin {
  id: string;
  nombre: string;
  tienePin: boolean;
}

/** Staff activo del gym, para el selector "¿quién eres?" al abrir/cerrar turno. */
export async function listStaffParaCheckin(
  gymId: string
): Promise<StaffParaCheckin[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("staff")
    .select("id, nombre, pin_hash")
    .eq("gym_id", gymId)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  return (data ?? []).map((s) => ({
    id: s.id as string,
    nombre: s.nombre as string,
    tienePin: !!s.pin_hash,
  }));
}

/** Asigna o cambia el PIN de un staff (lo hace el owner/gerente). */
export async function setStaffPin(
  gymId: string,
  staffId: string,
  pin: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: "El PIN debe ser de 4 dígitos." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("staff")
    .update({
      pin_hash: hashPin(pin),
      pin_intentos_fallidos: 0,
      pin_bloqueado_hasta: null,
    })
    .eq("gym_id", gymId)
    .eq("id", staffId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Quita el PIN de un staff (vuelve a no poder hacer check-in por PIN). */
export async function clearStaffPin(
  gymId: string,
  staffId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("staff")
    .update({
      pin_hash: null,
      pin_intentos_fallidos: 0,
      pin_bloqueado_hasta: null,
    })
    .eq("gym_id", gymId)
    .eq("id", staffId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Verifica el PIN de un staff. Bloquea temporalmente tras varios fallos —
 * un PIN de 4 dígitos son solo 10,000 combinaciones, así que sin esto
 * cualquiera podría adivinarlo por fuerza bruta en segundos.
 */
export async function verifyStaffPin(
  gymId: string,
  staffId: string,
  pin: string
): Promise<{ ok: true; nombre: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff")
    .select(
      "nombre, estado, pin_hash, pin_intentos_fallidos, pin_bloqueado_hasta"
    )
    .eq("gym_id", gymId)
    .eq("id", staffId)
    .maybeSingle();

  if (!staff || staff.estado !== "activo") {
    return { ok: false, error: "Usuario no encontrado." };
  }
  if (!staff.pin_hash) {
    return {
      ok: false,
      error: "No tienes un PIN configurado — pide al dueño que te asigne uno.",
    };
  }
  if (
    staff.pin_bloqueado_hasta &&
    new Date(staff.pin_bloqueado_hasta as string) > new Date()
  ) {
    return {
      ok: false,
      error: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
    };
  }

  if (hashPin(pin) !== staff.pin_hash) {
    const intentos = (staff.pin_intentos_fallidos as number) + 1;
    const bloqueadoHasta =
      intentos >= PIN_MAX_INTENTOS
        ? new Date(Date.now() + PIN_BLOQUEO_MIN * 60_000).toISOString()
        : null;
    await admin
      .from("staff")
      .update({
        pin_intentos_fallidos: intentos,
        pin_bloqueado_hasta: bloqueadoHasta,
      })
      .eq("gym_id", gymId)
      .eq("id", staffId);
    return {
      ok: false,
      error: bloqueadoHasta
        ? "Demasiados intentos. Espera unos minutos e intenta de nuevo."
        : "PIN incorrecto.",
    };
  }

  await admin
    .from("staff")
    .update({ pin_intentos_fallidos: 0, pin_bloqueado_hasta: null })
    .eq("gym_id", gymId)
    .eq("id", staffId);

  return { ok: true, nombre: staff.nombre as string };
}

export async function getStaffById(
  gymId: string,
  staffId: string
): Promise<Staff | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("gym_id", gymId)
    .eq("id", staffId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Staff;
}
