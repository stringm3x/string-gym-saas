import { createClient } from "@supabase/supabase-js";

/**
 * Client de Supabase con service-role — BYPASSEA RLS.
 * Usar SOLO en server, exclusivamente para la Auth Admin API
 * (invitar/crear usuarios de staff). Nunca exponer al cliente.
 *
 * Las lecturas de `staff` NO usan este client: la policy de auto-lectura
 * (migración 012, user_id = auth.uid()) permite resolver el rol propio
 * con el client de sesión normal.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
