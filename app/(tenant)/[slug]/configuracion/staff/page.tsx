import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getGymFull } from "@/lib/queries/gyms.queries";
import { listStaffByGym } from "@/lib/queries/staff.queries";
import { StaffManager } from "@/components/configuracion/StaffManager";

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

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary">
        Gestiona quién puede acceder al sistema de tu gimnasio y con qué rol.
      </p>

      <div className="pt-4">
        <StaffManager
          staff={staff}
          gymNombre={gym?.nombre ?? ""}
          cajaCheckinPin={gym?.caja_checkin_pin ?? false}
        />
      </div>
    </div>
  );
}
