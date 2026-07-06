import { randomBytes, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
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
}

/** Datos del miembro para el portal (scoped por tenant + id de la sesión). */
export async function getMiembroPortal(
  tenantId: string,
  miembroId: string
): Promise<MiembroPortal | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("miembros")
    .select("id, nombre, email, telefono, fecha_vencimiento, estado")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  return (data as MiembroPortal | null) ?? null;
}
