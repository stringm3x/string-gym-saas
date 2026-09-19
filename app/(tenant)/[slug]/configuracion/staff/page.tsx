import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { hasFeature } from "@/lib/features";
import { getGymFull } from "@/lib/queries/gyms.queries";
import { listStaffByGym } from "@/lib/queries/staff.queries";
import { StaffManager } from "@/components/configuracion/StaffManager";
import { UpgradePage } from "@/components/ui/UpgradePage";

export default async function StaffPage() {
  const tenant = await getTenant();

  // Gate server-side: mismo permiso que ya validan las server actions
  // (owner y gerente) — antes solo dejaba pasar a "owner" a secas, así que
  // un gerente con permiso real para invitar/gestionar staff se topaba con
  // un redirect al intentar entrar a esta página.
  if (!hasPermission(tenant.role, "gestionar_staff")) {
    redirect(`/${tenant.slug}/checkins`);
  }

  const [gym, staff] = await Promise.all([
    getGymFull(tenant.id),
    listStaffByGym(tenant.id),
  ]);

  // Starter = 1 usuario (el dueño). Multiusuario con roles es Pro. Si el
  // gym ya tenía staff antes de este gating, sus cuentas siguen entrando
  // (RLS); solo no puede invitar más desde aquí.
  if (!hasFeature(tenant.plan, "multiusuario")) {
    return (
      <UpgradePage
        titulo="Equipo"
        descripcion="Invita a recepcionistas, entrenadores y gerentes con su propio acceso y permisos por rol."
        beneficios={[
          "Usuarios ilimitados con roles (recepción, entrenador, gerente)",
          "Cada quien entra con su propia cuenta",
          "PIN por persona para abrir y cerrar caja",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  return (
    <StaffManager
      staff={staff}
      gymNombre={gym?.nombre ?? ""}
      cajaCheckinPin={gym?.caja_checkin_pin ?? false}
    />
  );
}
