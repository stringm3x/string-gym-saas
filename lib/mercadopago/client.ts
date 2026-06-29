import { MercadoPagoConfig } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Instancia del SDK de MercadoPago con el access token del gym.
 * Modelo marketplace/Checkout Bricks: cada gym cobra con SU cuenta MP, así que
 * el token es el del tenant (no uno global).
 */
export function getMpClient(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken });
}

/**
 * Lee el access token MP del gym (service-role: es un dato sensible que NUNCA
 * debe salir al cliente). Devuelve null si el gym no ha conectado MercadoPago.
 */
export async function getMpAccessToken(
  tenantId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gyms")
    .select("mp_access_token")
    .eq("id", tenantId)
    .maybeSingle();
  return data?.mp_access_token ?? null;
}
