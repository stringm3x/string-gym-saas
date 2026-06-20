import { createClient } from "@supabase/supabase-js";

/**
 * Client de Supabase con service-role — BYPASSEA RLS.
 * Usar SOLO en server (middleware, server actions, queries server-side)
 * y siempre con queries acotadas por gym_id + user_id. Nunca exponer al
 * cliente. Necesario para:
 *  - Resolver el rol de un recepcionista (la RLS de `staff` solo deja
 *    leer al owner; el staff no puede leer su propia fila con el client
 *    de sesión).
 *  - Invitar/crear usuarios vía Admin API.
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
