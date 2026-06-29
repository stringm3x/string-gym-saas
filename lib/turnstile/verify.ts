/**
 * Verifica un token de Cloudflare Turnstile contra el endpoint de siteverify.
 * Usa TURNSTILE_SECRET_KEY (server-only). Devuelve true solo si es válido.
 */
export async function verifyTurnstile(
  token: string,
  ip?: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body }
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
