import { createClient } from "@/lib/supabase/server";
import type { StringAdmin } from "@/lib/types/admin";

/**
 * Devuelve el StringAdmin activo de la sesión actual, o null.
 *
 * Usa el client de sesión (NO service-role): la policy de auto-lectura
 * (`user_id = auth.uid()`) permite a cada admin leer su propia fila. Si
 * el usuario no está en `string_admins` o está inactivo → null.
 *
 * Este es el gate de autenticación del panel admin; funciona en cualquier
 * dominio/host porque depende de la sesión Supabase, no del middleware.
 */
export async function getCurrentAdmin(): Promise<StringAdmin | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("string_admins")
    .select("user_id, email, nombre, role, activo, created_at, ultimo_acceso")
    .eq("user_id", user.id)
    .eq("activo", true)
    .maybeSingle();

  return (data as StringAdmin | null) ?? null;
}

/**
 * Registra un evento administrativo (append-only) vía RPC SECURITY
 * DEFINER. La función SQL revalida `is_super_admin()` server-side, así
 * que un no-admin no puede escribir aunque invoque el RPC.
 */
export async function logAdminEvent(
  accion: string,
  opts?: {
    targetTenantId?: string | null;
    targetUserId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("log_admin_event", {
    p_accion: accion,
    p_target_tenant_id: opts?.targetTenantId ?? null,
    p_target_user_id: opts?.targetUserId ?? null,
    p_metadata: opts?.metadata ?? {},
  });
}
