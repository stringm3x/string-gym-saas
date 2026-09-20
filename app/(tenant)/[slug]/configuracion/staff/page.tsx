import { requirePanel } from "@/lib/authz/pagina";
import { getGymFull } from "@/lib/queries/gyms.queries";
import { listStaffByGym } from "@/lib/queries/staff.queries";
import { StaffManager } from "@/components/configuracion/StaffManager";
import { UpgradePage } from "@/components/ui/UpgradePage";

export default async function StaffPage() {
  // Misma política que inviteStaffAction (multiusuario + gestionar_staff).
  const g = await requirePanel("config.staff_invitar", { sinPermiso: "/checkins" });
  const tenant = g.ctx;

  const [gym, staff] = await Promise.all([
    getGymFull(tenant.id),
    listStaffByGym(tenant.id),
  ]);

  // Si el gym ya tenía staff antes de este gating, sus cuentas siguen
  // entrando (RLS); solo no puede gestionarlas desde aquí.
  if (!g.ok) {
    return (
      <UpgradePage
        titulo="Equipo"
        descripcion="Invita a recepcionistas, entrenadores y gerentes con su propio acceso y permisos por rol."
        beneficios={[
          "Usuarios ilimitados con roles (recepción, entrenador, gerente)",
          "Cada quien entra con su propia cuenta",
          "PIN por persona para abrir y cerrar caja",
        ]}
        planRequerido={g.planRequerido}
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
