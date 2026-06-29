import { createClient } from "@/lib/supabase/server";

export interface MpStatus {
  connected: boolean;
  email: string | null;
}

/**
 * Estado de la integración MP del gym. NO devuelve el access token (sensible),
 * solo si está conectado y el email de la cuenta.
 */
export async function getMpStatus(tenantId: string): Promise<MpStatus> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("mp_access_token, mp_email")
    .eq("id", tenantId)
    .maybeSingle();
  return {
    connected: !!data?.mp_access_token,
    email: data?.mp_email ?? null,
  };
}

export async function saveMpCredentials(
  tenantId: string,
  creds: { token: string; email: string | null; userId: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({
      mp_access_token: creds.token,
      mp_email: creds.email,
      mp_user_id: creds.userId,
    })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function clearMpCredentials(
  tenantId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({
      mp_access_token: null,
      mp_email: null,
      mp_user_id: null,
      mp_public_key: null,
    })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
