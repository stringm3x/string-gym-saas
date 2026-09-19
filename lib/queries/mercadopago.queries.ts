import { createClient } from "@/lib/supabase/server";

// La única policy de UPDATE sobre `gyms` es owner_id = auth.uid(): un
// gerente afecta 0 filas sin error (ver gyms.queries.ts).
const ERROR_SOLO_OWNER =
  "No se guardó: por ahora solo el dueño puede cambiar esto.";

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
  const { data, error } = await supabase
    .from("gyms")
    .update({
      mp_access_token: creds.token,
      mp_email: creds.email,
      mp_user_id: creds.userId,
    })
    .eq("id", tenantId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: ERROR_SOLO_OWNER };
  return { ok: true };
}

export async function clearMpCredentials(
  tenantId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .update({
      mp_access_token: null,
      mp_email: null,
      mp_user_id: null,
      mp_public_key: null,
    })
    .eq("id", tenantId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: ERROR_SOLO_OWNER };
  return { ok: true };
}

export interface PagoExternoPendiente {
  id: string;
  monto: number;
  status: string;
  descripcion: string | null;
  createdAt: string;
}

/**
 * Cobros con MercadoPago generados pero aún sin confirmar por el webhook
 * (últimas 24h) — para mostrar "pendiente de confirmación" en Caja en vez
 * de dejar al cajero sin ninguna señal hasta que el webhook llegue.
 */
export async function listPagosExternosPendientes(
  tenantId: string
): Promise<PagoExternoPendiente[]> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("pagos_externos")
    .select("id, monto, status, metadata, created_at")
    .eq("tenant_id", tenantId)
    .is("pago_id", null)
    .in("status", ["pending", "in_process"])
    .gte("created_at", desde)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    monto: r.monto,
    status: r.status,
    descripcion:
      (r.metadata as { descripcion?: string } | null)?.descripcion ?? null,
    createdAt: r.created_at,
  }));
}
