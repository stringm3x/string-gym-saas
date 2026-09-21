import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRIAL_DIAS, DEMO_MIEMBRO_NOTAS } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SolicitudEstado =
  | "nuevo"
  | "contactado"
  | "activado"
  | "descartado";

export interface Solicitud {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  nombre_gym: string | null;
  plan_interes: string | null;
  ciudad: string | null;
  miembros_aprox: number | null;
  como_entero: string | null;
  notas: string | null;
  estado: SolicitudEstado;
  created_at: string;
}

const COLS =
  "id, nombre, email, telefono, nombre_gym, plan_interes, ciudad, miembros_aprox, como_entero, notas, estado, created_at";

export async function getSolicitudes(filtros?: {
  estado?: string;
}): Promise<Solicitud[]> {
  const admin = createAdminClient();
  let q = admin
    .from("solicitudes_prueba")
    .select(COLS)
    .order("created_at", { ascending: false });
  if (filtros?.estado) q = q.eq("estado", filtros.estado);
  const { data } = await q;
  return (data ?? []) as Solicitud[];
}

export async function createSolicitud(input: {
  nombre: string;
  email: string;
  telefono?: string;
  nombre_gym?: string;
  plan_interes?: string;
  ciudad?: string;
  miembros_aprox?: number;
  como_entero?: string;
  notas?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("solicitudes_prueba")
    .insert({
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono || null,
      nombre_gym: input.nombre_gym || null,
      plan_interes: input.plan_interes || null,
      ciudad: input.ciudad || null,
      miembros_aprox: input.miembros_aprox ?? null,
      como_entero: input.como_entero || null,
      notas: input.notas || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message };
  return { ok: true, id: data.id };
}

export async function updateSolicitudEstado(
  id: string,
  estado: SolicitudEstado
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("solicitudes_prueba")
    .update({ estado })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────── activar ───────────────────────────

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "gym"
  );
}

async function slugUnico(admin: SupabaseClient, base: string): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidato = i === 0 ? root : `${root}-${i + 1}`;
    const { data } = await admin
      .from("gyms")
      .select("id")
      .eq("slug", candidato)
      .maybeSingle();
    if (!data) return candidato;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

export interface ActivarResult {
  ok: boolean;
  error?: string;
  slug?: string;
  email?: string;
  nombreGym?: string;
  inviteLink?: string;
}

/**
 * Activa una solicitud: invita al owner en Supabase Auth y crea el gym
 * (tenant). El trigger create_owner_staff genera el staff owner. Nunca
 * existe una contraseña temporal: el dueño la crea él mismo al abrir el
 * enlace de invitación (Bloque 10 PR2 — mismo mecanismo que las
 * invitaciones de staff en configuracion/staff/actions.ts, reutilizando
 * /auth/nueva-password como landing en vez de un flujo nuevo). Devuelve el
 * enlace para que el caller envíe el email de bienvenida. Rollback del
 * usuario si el insert del gym falla.
 */
export async function activarSolicitud(id: string): Promise<ActivarResult> {
  const admin = createAdminClient();

  const { data: sol } = await admin
    .from("solicitudes_prueba")
    .select("id, nombre, email, nombre_gym, plan_interes, estado")
    .eq("id", id)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitud no encontrada." };
  if (sol.estado === "activado") {
    return { ok: false, error: "La solicitud ya fue activada." };
  }

  const nombreGym = sol.nombre_gym || sol.nombre;
  // La prueba de 14 días es siempre con Pro completo (así lo promete la web
  // y así se decidió). El plan de interés queda en la solicitud para que
  // Carlos active el plan pagado correcto al terminar la prueba.
  const plan = "pro";

  // 1. Owner en Auth: invitación, no contraseña temporal.
  const redirectTo = process.env.APP_DOMAIN
    ? `https://${process.env.APP_DOMAIN}/auth/nueva-password`
    : undefined;
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "invite",
    email: sol.email,
    options: { redirectTo },
  });
  if (linkErr || !link?.user) {
    return {
      ok: false,
      error:
        linkErr?.message?.includes("registered") || linkErr?.code === "email_exists"
          ? "Ya existe un usuario con ese email."
          : (linkErr?.message ?? "No se pudo invitar al usuario."),
    };
  }
  const ownerId = link.user.id;
  const inviteLink = link.properties.action_link;

  // 2. Gym en prueba gratuita (Fase 7.3): estado 'prueba' + fin de prueba a
  // TRIAL_DIAS. El trigger create_owner_staff crea el staff owner. Al vencer,
  // el proxy redirige a /suspendida; Carlos reactiva o extiende desde el Admin.
  const slug = await slugUnico(admin, nombreGym);
  const pruebaHasta = new Date(Date.now() + TRIAL_DIAS * 24 * 60 * 60 * 1000);
  const { data: gym, error: gymErr } = await admin
    .from("gyms")
    .insert({
      nombre: nombreGym,
      slug,
      owner_id: ownerId,
      plan,
      estado: "prueba",
      prueba_hasta: pruebaHasta.toISOString(),
    })
    .select("id, slug")
    .single();
  if (gymErr || !gym) {
    await admin.auth.admin.deleteUser(ownerId); // rollback
    return { ok: false, error: gymErr?.message ?? "No se pudo crear el gym." };
  }

  // 3. Caja default (sql/063_cajas_multiples.sql): todo pago que no viene de
  // un punto de venta físico (portal, kiosco, cuotas de crédito…) se enlaza
  // a ella — sin esto ningún pago del gym entra a ningún corte. Best-effort
  // como el resto del setup posterior al gym: si falla, el dueño puede crear
  // una caja a mano desde Configuración → Cajas (la página de Caja ya lo
  // ofrece cuando no encuentra ninguna), pero se deja rastro en el log para
  // que no pase inadvertido.
  const { error: cajaErr } = await admin
    .from("cajas")
    .insert({ tenant_id: gym.id, nombre: "Recepción", es_default: true });
  if (cajaErr) {
    console.error(
      `[activarSolicitud] no se pudo crear la caja default de ${gym.slug}:`,
      cajaErr.message
    );
  }

  // 4. Miembro de demo (Fase P.2): deja al owner probar Portal/QR/check-in.
  // Best-effort — no bloquea la activación si algo falla. Un gym recién creado
  // aún no tiene planes, así que plan_id suele quedar null. El email = el del
  // owner, para que pueda entrar al portal del demo con su propio correo.
  try {
    const { data: planBarato } = await admin
      .from("planes_membresia")
      .select("id")
      .eq("tenant_id", gym.id)
      .eq("activo", true)
      .order("precio", { ascending: true })
      .limit(1)
      .maybeSingle();
    const vencDemo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await admin.from("miembros").insert({
      tenant_id: gym.id,
      nombre: "Demo Miembro",
      telefono: "5500000000",
      email: sol.email,
      estado: "activo",
      fecha_vencimiento: vencDemo,
      plan_id: planBarato?.id ?? null,
      notas: DEMO_MIEMBRO_NOTAS,
    });
  } catch {
    /* best-effort */
  }

  // 5. Marcar solicitud como activada.
  await admin.from("solicitudes_prueba").update({ estado: "activado" }).eq("id", id);

  return {
    ok: true,
    slug: gym.slug,
    email: sol.email,
    nombreGym,
    inviteLink,
  };
}
