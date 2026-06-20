"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffById } from "@/lib/queries/staff.queries";
import { inviteStaffSchema } from "@/lib/validations/staff.schema";

export interface StaffActionState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

interface SimpleResult {
  ok: boolean;
  error?: string;
}

const empty: StaffActionState = { ok: false, error: null, fieldErrors: {} };

/** Gate compartido: solo el owner del gym puede gestionar staff. */
async function requireOwner() {
  const tenant = await getTenant();
  if (tenant.role !== "owner") return { tenant, allowed: false as const };
  return { tenant, allowed: true as const };
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function inviteStaffAction(
  _prev: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ...empty, error: "Sin permiso." };

  const parsed = inviteStaffSchema.safeParse({
    email: formData.get("email"),
    nombre: formData.get("nombre"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const path = key !== undefined ? String(key) : undefined;
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const { email, nombre } = parsed.data;
  const supabase = await createClient();

  // Email único por gym.
  const { data: existing } = await supabase
    .from("staff")
    .select("id")
    .eq("gym_id", tenant.id)
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: null,
      fieldErrors: { email: "Ya existe un miembro del equipo con ese correo." },
    };
  }

  // Crear la fila staff primero para tener el staff_id del redirect.
  const { data: inserted, error: insError } = await supabase
    .from("staff")
    .insert({
      gym_id: tenant.id,
      email,
      nombre,
      rol: "receptionist",
      estado: "invitado",
    })
    .select("id")
    .single();

  if (insError || !inserted) {
    return { ...empty, error: insError?.message ?? "No se pudo crear la invitación." };
  }

  const staffId = inserted.id;
  const origin = await getOrigin();
  const admin = createAdminClient();

  const { data: invite, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/accept-invite?staff_id=${staffId}`,
    });

  if (inviteError || !invite?.user) {
    // Rollback de la fila staff si la invitación falla.
    await supabase.from("staff").delete().eq("id", staffId);
    return {
      ...empty,
      error: inviteError?.message ?? "No se pudo enviar la invitación.",
    };
  }

  // Guardar el user_id creado por la invitación (permite cleanup posterior).
  await supabase
    .from("staff")
    .update({ user_id: invite.user.id })
    .eq("id", staffId);

  revalidatePath(`/${tenant.slug}/configuracion/staff`);
  return { ok: true, error: null, fieldErrors: {} };
}

export async function resendInviteAction(
  staffId: string
): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const staff = await getStaffById(tenant.id, staffId);
  if (!staff || staff.estado !== "invitado") {
    return { ok: false, error: "La invitación ya no está pendiente." };
  }

  const origin = await getOrigin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(staff.email, {
    redirectTo: `${origin}/auth/accept-invite?staff_id=${staff.id}`,
  });
  if (error) return { ok: false, error: error.message };

  const supabase = await createClient();
  await supabase
    .from("staff")
    .update({ created_at: new Date().toISOString() })
    .eq("id", staff.id);

  revalidatePath(`/${tenant.slug}/configuracion/staff`);
  return { ok: true };
}

export async function cancelInviteAction(
  staffId: string
): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const staff = await getStaffById(tenant.id, staffId);
  if (!staff || staff.estado !== "invitado") {
    return { ok: false, error: "La invitación ya no está pendiente." };
  }

  // La invitación creó un auth user sin confirmar — eliminarlo para que el
  // email pueda re-invitarse.
  if (staff.user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(staff.user_id);
  }

  const supabase = await createClient();
  await supabase
    .from("staff")
    .delete()
    .eq("gym_id", tenant.id)
    .eq("id", staff.id);

  revalidatePath(`/${tenant.slug}/configuracion/staff`);
  return { ok: true };
}

export async function deactivateStaffAction(
  staffId: string
): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const staff = await getStaffById(tenant.id, staffId);
  if (!staff) return { ok: false, error: "No encontrado." };
  if (staff.rol === "owner") {
    return { ok: false, error: "No se puede desactivar al dueño." };
  }
  if (staff.estado !== "activo") {
    return { ok: false, error: "Solo se puede desactivar a un miembro activo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ estado: "desactivado", desactivado_at: new Date().toISOString() })
    .eq("gym_id", tenant.id)
    .eq("id", staff.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${tenant.slug}/configuracion/staff`);
  return { ok: true };
}

export async function reactivateStaffAction(
  staffId: string
): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const staff = await getStaffById(tenant.id, staffId);
  if (!staff) return { ok: false, error: "No encontrado." };
  if (staff.estado !== "desactivado") {
    return { ok: false, error: "Solo se puede reactivar a un miembro desactivado." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ estado: "activo", desactivado_at: null })
    .eq("gym_id", tenant.id)
    .eq("id", staff.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${tenant.slug}/configuracion/staff`);
  return { ok: true };
}

export async function deleteStaffAction(
  staffId: string
): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const staff = await getStaffById(tenant.id, staffId);
  if (!staff) return { ok: false, error: "No encontrado." };
  if (staff.rol === "owner") {
    return { ok: false, error: "No se puede eliminar al dueño." };
  }
  if (staff.estado !== "desactivado") {
    return {
      ok: false,
      error: "Desactiva al miembro antes de eliminarlo permanentemente.",
    };
  }

  // Limpieza total: eliminar también la cuenta auth para liberar el email.
  if (staff.user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(staff.user_id);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .delete()
    .eq("gym_id", tenant.id)
    .eq("id", staff.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${tenant.slug}/configuracion/staff`);
  return { ok: true };
}
