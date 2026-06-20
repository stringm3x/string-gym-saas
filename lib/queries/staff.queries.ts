import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/types/staff";

/**
 * Resuelve el staff activo de un usuario en un gym. Usa el client de
 * sesión: la policy "users_can_read_own_staff_record" (migración 012)
 * permite a cada usuario leer su propia fila (user_id = auth.uid()).
 */
export async function getActiveStaff(
  gymId: string,
  userId: string
): Promise<Staff | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("gym_id", gymId)
    .eq("user_id", userId)
    .eq("estado", "activo")
    .maybeSingle();

  if (error || !data) return null;
  return data as Staff;
}

/**
 * Lista todo el staff de un gym (para el manager del owner).
 * Usa el client de sesión: la RLS owner_can_view_staff lo permite.
 */
export async function listStaffByGym(gymId: string): Promise<Staff[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as Staff[];
}

export async function getStaffById(
  gymId: string,
  staffId: string
): Promise<Staff | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("gym_id", gymId)
    .eq("id", staffId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Staff;
}
