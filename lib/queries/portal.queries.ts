import { randomBytes, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesionesByRango } from "@/lib/queries/clases.queries";
import type { ClaseSesion } from "@/lib/types/clases";
import type { Plan } from "@/lib/features";

const OTP_TTL_MIN = 10;
const SESSION_TTL_DIAS = 30;
const MAX_INTENTOS = 5;
const REENVIO_MIN_SEG = 60;

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function generarCodigo(): string {
  // 6 dígitos uniformes (sin sesgo por módulo grande).
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

export interface PortalGym {
  id: string;
  slug: string;
  nombre: string;
  plan: Plan;
  telefono: string | null;
  estado: string;
}

/** ¿El gym tiene MercadoPago conectado? (para ofrecer renovación en línea). */
export async function getPortalMpDisponible(tenantId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gyms")
    .select("mp_access_token")
    .eq("id", tenantId)
    .maybeSingle();
  return !!data?.mp_access_token;
}

/** Gym público por slug (para el portal). */
export async function getPortalGym(slug: string): Promise<PortalGym | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gyms")
    .select("id, slug, nombre, plan, telefono, estado")
    .eq("slug", slug)
    .maybeSingle();
  return (data as PortalGym | null) ?? null;
}

/**
 * Color de acento del gym para tematizar el portal. Query DEDICADA (no toca
 * getPortalGym) para no acoplar su SELECT a esta columna.
 */
export async function getPortalColorAcento(slug: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gyms")
    .select("color_acento")
    .eq("slug", slug)
    .maybeSingle();
  return (data?.color_acento as string | null) ?? null;
}

export interface PortalMiembro {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
}

/**
 * Encuentra al miembro por email (si el dato trae '@') o por teléfono
 * (comparando solo dígitos). Se resuelve en memoria sobre los miembros no
 * archivados del tenant: es un gym, el volumen es bajo y evita depender de
 * normalización en la BD.
 */
export async function findMiembroByIdentificador(
  tenantId: string,
  identificador: string
): Promise<PortalMiembro | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("miembros")
    .select("id, nombre, email, telefono")
    .eq("tenant_id", tenantId)
    .eq("archivado", false);
  const miembros = (data ?? []) as PortalMiembro[];

  const id = identificador.trim();
  if (id.includes("@")) {
    const email = id.toLowerCase();
    return (
      miembros.find((m) => (m.email ?? "").toLowerCase() === email) ?? null
    );
  }
  const tel = soloDigitos(id);
  if (tel.length < 8) return null;
  return (
    miembros.find((m) => soloDigitos(m.telefono ?? "").endsWith(tel)) ?? null
  );
}

/**
 * Crea un código de verificación para el miembro y devuelve el código en
 * claro (para enviarlo). Aplica throttle: no reenvía si hay uno de hace menos
 * de REENVIO_MIN_SEG segundos.
 */
export async function crearVerificacion(
  tenantId: string,
  miembroId: string,
  canal: "email" | "whatsapp" | "sms" = "email"
): Promise<
  | { ok: true; codigo: string }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();

  const desde = new Date(Date.now() - REENVIO_MIN_SEG * 1000).toISOString();
  const { count } = await admin
    .from("miembro_verificaciones")
    .select("id", { count: "exact", head: true })
    .eq("miembro_id", miembroId)
    .gte("created_at", desde);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Espera un momento antes de pedir otro código." };
  }

  const codigo = generarCodigo();
  const { error } = await admin.from("miembro_verificaciones").insert({
    tenant_id: tenantId,
    miembro_id: miembroId,
    codigo_hash: sha256(codigo),
    canal,
    expira_at: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false, error: "No se pudo generar el código." };
  return { ok: true, codigo };
}

/** Valida el código vigente del miembro. Un solo uso, con límite de intentos. */
export async function verificarCodigo(
  tenantId: string,
  miembroId: string,
  codigo: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: verif } = await admin
    .from("miembro_verificaciones")
    .select("id, codigo_hash, expira_at, usado_at, intentos")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .is("usado_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!verif) return { ok: false, error: "Solicita un código nuevo." };
  if (new Date(verif.expira_at) < new Date()) {
    return { ok: false, error: "El código expiró. Solicita uno nuevo." };
  }
  if (verif.intentos >= MAX_INTENTOS) {
    return { ok: false, error: "Demasiados intentos. Solicita un código nuevo." };
  }

  if (sha256(codigo.trim()) !== verif.codigo_hash) {
    await admin
      .from("miembro_verificaciones")
      .update({ intentos: verif.intentos + 1 })
      .eq("id", verif.id);
    return { ok: false, error: "Código incorrecto." };
  }

  await admin
    .from("miembro_verificaciones")
    .update({ usado_at: new Date().toISOString() })
    .eq("id", verif.id);
  return { ok: true };
}

/** Crea una sesión de 30 días y devuelve el token crudo (va en cookie). */
export async function crearSession(
  tenantId: string,
  miembroId: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("miembro_sessions").insert({
    tenant_id: tenantId,
    miembro_id: miembroId,
    token_hash: sha256(token),
    expira_at: new Date(
      Date.now() + SESSION_TTL_DIAS * 24 * 60 * 60 * 1000
    ).toISOString(),
  });
  if (error) return { ok: false, error: "No se pudo iniciar sesión." };
  return { ok: true, token };
}

export interface SessionMiembro {
  miembroId: string;
  tenantId: string;
}

/** Resuelve una sesión válida (no expirada) a partir del token crudo. */
export async function getSessionByToken(
  token: string
): Promise<SessionMiembro | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("miembro_sessions")
    .select("miembro_id, tenant_id, expira_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expira_at) < new Date()) return null;
  return { miembroId: data.miembro_id, tenantId: data.tenant_id };
}

/** Cierra la sesión (logout). */
export async function eliminarSession(token: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("miembro_sessions")
    .delete()
    .eq("token_hash", sha256(token));
}

export interface MiembroPortal {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  fecha_vencimiento: string | null;
  estado: string;
  visitas_restantes: number | null;
}

/** Datos del miembro para el portal (scoped por tenant + id de la sesión). */
export async function getMiembroPortal(
  tenantId: string,
  miembroId: string
): Promise<MiembroPortal | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("miembros")
    .select(
      "id, nombre, email, telefono, fecha_vencimiento, estado, visitas_restantes"
    )
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  return (data as MiembroPortal | null) ?? null;
}

/** Token del QR de acceso del socio (para mostrarlo/descargarlo en el portal). */
export async function getQrTokenPortal(
  tenantId: string,
  miembroId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("miembros")
    .select("qr_token")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  return (data?.qr_token as string | null) ?? null;
}

export interface ReservaPortal {
  id: string;
  sesion_id: string;
  estado: string;
  fecha: string;
  hora_inicio: string;
  clase_nombre: string;
}

interface ReservaRaw {
  id: string;
  sesion_id: string;
  estado: string;
  sesion: {
    fecha: string;
    hora_inicio: string;
    clase: { nombre: string } | null;
  } | null;
}

/** Próximas reservas activas del miembro (sesión de hoy en adelante). */
export async function getProximasReservasPortal(
  tenantId: string,
  miembroId: string
): Promise<ReservaPortal[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clases_reservas")
    .select(
      "id, sesion_id, estado, sesion:clases_sesiones(fecha, hora_inicio, clase:clases(nombre))"
    )
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .in("estado", ["confirmada", "en_lista_espera"]);

  const hoy = new Date().toISOString().slice(0, 10);
  return ((data ?? []) as unknown as ReservaRaw[])
    .filter((r) => r.sesion && r.sesion.fecha >= hoy)
    .map((r) => ({
      id: r.id,
      sesion_id: r.sesion_id,
      estado: r.estado,
      fecha: r.sesion!.fecha,
      hora_inicio: r.sesion!.hora_inicio,
      clase_nombre: r.sesion!.clase?.nombre ?? "Clase",
    }))
    .sort((a, b) =>
      (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio)
    );
}

export interface CheckinPortal {
  id: string;
  fecha_hora: string;
}

/**
 * Clases disponibles para reservar desde el portal: sesiones programadas de
 * hoy hasta `dias` adelante. Reusa getSesionesByRango con service-role.
 */
export async function getClasesDisponiblesPortal(
  tenantId: string,
  dias = 14
): Promise<ClaseSesion[]> {
  const admin = createAdminClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const hasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const sesiones = await getSesionesByRango(tenantId, hoy, hasta, admin);
  return sesiones.filter((s) => s.estado === "programada");
}

export interface ReciboPortal {
  id: string;
  fecha_pago: string;
  concepto: string;
  monto: number;
  token_publico: string;
}

/** Pagos del miembro con recibo público descargable (no anulados). */
export async function getRecibosPortal(
  tenantId: string,
  miembroId: string
): Promise<ReciboPortal[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pagos")
    .select("id, fecha_pago, concepto, monto, token_publico, anulado_at")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .is("anulado_at", null)
    .is("reembolsado_at", null)
    .order("fecha_pago", { ascending: false });

  return ((data ?? []) as Array<{
    id: string;
    fecha_pago: string;
    concepto: string;
    monto: number | string;
    token_publico: string | null;
  }>)
    .filter((p) => p.token_publico)
    .map((p) => ({
      id: p.id,
      fecha_pago: p.fecha_pago,
      concepto: p.concepto,
      monto: Number(p.monto),
      token_publico: p.token_publico as string,
    }));
}

/** Check-ins del miembro en los últimos `dias` días. */
export async function getCheckinsPortal(
  tenantId: string,
  miembroId: string,
  dias = 30
): Promise<CheckinPortal[]> {
  const admin = createAdminClient();
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("checkins")
    .select("id, fecha_hora")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .gte("fecha_hora", desde)
    .order("fecha_hora", { ascending: false });
  return (data ?? []) as CheckinPortal[];
}
