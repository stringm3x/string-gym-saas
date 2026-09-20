"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { panelAction, type Denegado } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStaffById,
  setStaffPin,
  clearStaffPin,
} from "@/lib/queries/staff.queries";
import { inviteStaffSchema } from "@/lib/validations/staff.schema";

// Todas declaran multiusuario + gestionar_staff (owner y gerente, D6) en
// lib/authz/politicas.ts. Ya no hay un `requireOwner()` que no exigía owner.

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

const ROLES_INVITABLES = ["receptionist", "entrenador", "gerente"] as const;

async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export const inviteStaffAction = panelAction(
  "config.staff_invitar",
  {
    onDenied: (d: Denegado): StaffActionState => ({
      ...empty,
      error:
        d.code === "SIN_PLAN"
          ? "Invitar a tu equipo está disponible en Plan Pro."
          : d.error,
    }),
  },
  async (tenant, _prev: StaffActionState, formData: FormData): Promise<StaffActionState> => {
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
    const rolRaw = String(formData.get("rol") ?? "receptionist");
    const rol = (ROLES_INVITABLES as readonly string[]).includes(rolRaw)
      ? rolRaw
      : "receptionist";
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
        rol,
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
);

export const resendInviteAction = panelAction(
  "config.staff_reenviar",
  {},
  async (tenant, staffId: string): Promise<SimpleResult> => {
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
);

export const cancelInviteAction = panelAction(
  "config.staff_cancelar_invitacion",
  {},
  async (tenant, staffId: string): Promise<SimpleResult> => {
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
);

export const deactivateStaffAction = panelAction(
  "config.staff_desactivar",
  {},
  async (tenant, staffId: string): Promise<SimpleResult> => {
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
);

export const reactivateStaffAction = panelAction(
  "config.staff_reactivar",
  {},
  async (tenant, staffId: string): Promise<SimpleResult> => {
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
);

export const deleteStaffAction = panelAction(
  "config.staff_eliminar",
  {},
  async (tenant, staffId: string): Promise<SimpleResult> => {
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
);

export const setStaffPinAction = panelAction(
  "config.staff_pin_asignar",
  {},
  async (tenant, staffId: string, pin: string): Promise<SimpleResult> => {
    const staff = await getStaffById(tenant.id, staffId);
    if (!staff) return { ok: false, error: "No encontrado." };
    if (staff.estado !== "activo") {
      return { ok: false, error: "Solo se puede asignar PIN a un miembro activo." };
    }

    const result = await setStaffPin(tenant.id, staffId, pin);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/${tenant.slug}/configuracion/staff`);
    return { ok: true };
  }
);

export const clearStaffPinAction = panelAction(
  "config.staff_pin_quitar",
  {},
  async (tenant, staffId: string): Promise<SimpleResult> => {
    const staff = await getStaffById(tenant.id, staffId);
    if (!staff) return { ok: false, error: "No encontrado." };

    const result = await clearStaffPin(tenant.id, staffId);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/${tenant.slug}/configuracion/staff`);
    return { ok: true };
  }
);

/** Prende/apaga que abrir/cerrar turno de caja exija PIN en vez de confiar
 * en la sesión activa del navegador (útil en una tablet compartida). */
export const toggleCajaCheckinPinAction = panelAction(
  "config.caja_pin_checkin",
  {},
  async (tenant, activar: boolean): Promise<SimpleResult> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("gyms")
      .update({ caja_checkin_pin: activar })
      .eq("id", tenant.id)
      .select("id");
    if (error) return { ok: false, error: error.message };
    // La única policy de UPDATE sobre `gyms` es owner_id = auth.uid(): la
    // política acepta owner y gerente, pero un gerente afecta 0 filas sin
    // error. Es la RLS, no el código, la que lo hace owner-only.
    if (!data || data.length === 0) {
      return {
        ok: false,
        error: "No se guardó: por ahora solo el dueño puede cambiar esto.",
      };
    }

    revalidatePath(`/${tenant.slug}/configuracion/staff`);
    revalidatePath(`/${tenant.slug}/caja`);
    return { ok: true };
  }
);
