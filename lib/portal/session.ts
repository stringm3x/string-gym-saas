import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/features";
import {
  getSessionByToken,
  getPortalGym,
  type SessionMiembro,
  type PortalGym,
} from "@/lib/queries/portal.queries";

const COOKIE = "portal_session";
const PATH = "/portal";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 días

export async function setPortalCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: PATH,
    maxAge: MAX_AGE,
  });
}

export async function clearPortalCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "", { path: PATH, maxAge: 0 });
}

export async function getPortalToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** Sesión del miembro actual (o null) leyendo la cookie httpOnly del portal. */
export async function getPortalSession(): Promise<SessionMiembro | null> {
  const token = await getPortalToken();
  if (!token) return null;
  return getSessionByToken(token);
}

/**
 * Guard de las páginas del portal: valida feature del gym + sesión vigente que
 * pertenezca a ese gym. Redirige al login si algo falla. Devuelve gym+sesión.
 */
export async function requirePortal(
  slug: string
): Promise<{ gym: PortalGym; session: SessionMiembro }> {
  const gym = await getPortalGym(slug);
  if (!gym || !hasFeature(gym.plan, "portal_miembro")) {
    redirect(`/portal/${slug}/login`);
  }
  const session = await getPortalSession();
  if (!session || session.tenantId !== gym.id) {
    redirect(`/portal/${slug}/login`);
  }
  return { gym, session };
}
