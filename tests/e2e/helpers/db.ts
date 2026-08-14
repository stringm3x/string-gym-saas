import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { E2E_GYM_SLUG } from "./env";

let admin: SupabaseClient | null = null;

/**
 * Cliente admin (service role) para leer fixtures directo de la BD —
 * p.ej. el qr_token de un miembro, que no hay forma de obtener por UI sin
 * antes tener el QR físico (justo lo que el kiosco reemplaza).
 */
function adminClient(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local"
    );
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

/** qr_token de un miembro activo (no archivado) de gym-demo, para probar el kiosco. */
export async function getMiembroConQr(): Promise<{
  id: string;
  nombre: string;
  qr_token: string;
} | null> {
  const sb = adminClient();
  const { data: gym } = await sb
    .from("gyms")
    .select("id")
    .eq("slug", E2E_GYM_SLUG)
    .maybeSingle();
  if (!gym) return null;

  // Vigente (o sin fecha) para que el check-in del kiosco no lo rechace
  // por "Membresía vencida" — cualquier miembro con qr_token nos sirve
  // para el resto de los flujos.
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from("miembros")
    .select("id, nombre, qr_token, fecha_vencimiento")
    .eq("tenant_id", gym.id)
    .eq("archivado", false)
    .not("qr_token", "is", null)
    .or(`fecha_vencimiento.gte.${hoy},fecha_vencimiento.is.null`)
    .limit(1)
    .maybeSingle();

  return (data as { id: string; nombre: string; qr_token: string } | null) ?? null;
}

/**
 * `n` miembros distintos con email (para el portal). Uno por test evita el
 * throttle de reenvío de OTP (60s por miembro_id en solicitarCodigoAction).
 */
export async function getMiembrosConEmail(
  n: number
): Promise<{ id: string; nombre: string; email: string }[]> {
  const sb = adminClient();
  const { data: gym } = await sb
    .from("gyms")
    .select("id")
    .eq("slug", E2E_GYM_SLUG)
    .maybeSingle();
  if (!gym) return [];

  const { data } = await sb
    .from("miembros")
    .select("id, nombre, email")
    .eq("tenant_id", gym.id)
    .eq("archivado", false)
    .not("email", "is", null)
    .order("nombre")
    .limit(n);

  return (data ?? []) as { id: string; nombre: string; email: string }[];
}

/**
 * Borra las verificaciones OTP previas del miembro — evita el throttle de
 * reenvío (60s) si una corrida anterior de la suite dejó una reciente.
 */
export async function clearOtpThrottle(miembroId: string): Promise<void> {
  const sb = adminClient();
  await sb.from("miembro_verificaciones").delete().eq("miembro_id", miembroId);
}

/** Sobrescribe el email de un miembro (y devuelve el original para restaurarlo). */
export async function setMiembroEmail(miembroId: string, email: string): Promise<void> {
  const sb = adminClient();
  await sb.from("miembros").update({ email }).eq("id", miembroId);
}

/**
 * Sobrescribe el código OTP más reciente (sin usar) del miembro con un
 * valor conocido — reemplaza el canal de entrega (email/WhatsApp, que no
 * podemos leer en el test) sin dejar de ejercitar solicitar+verificar
 * reales del portal.
 */
export async function setOtpCode(miembroId: string, codigo: string): Promise<void> {
  const sb = adminClient();
  const codigo_hash = createHash("sha256").update(codigo).digest("hex");
  const { data: verif } = await sb
    .from("miembro_verificaciones")
    .select("id")
    .eq("miembro_id", miembroId)
    .is("usado_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!verif) throw new Error(`Sin verificación pendiente para miembro ${miembroId}`);

  await sb
    .from("miembro_verificaciones")
    .update({
      codigo_hash,
      intentos: 0,
      expira_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .eq("id", verif.id);
}
