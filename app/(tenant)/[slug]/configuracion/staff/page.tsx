import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listStaffByGym } from "@/lib/queries/staff.queries";
import { StaffManager } from "@/components/configuracion/StaffManager";

export default async function StaffPage() {
  const tenant = await getTenant();

  // Gate server-side: solo el owner gestiona staff.
  if (tenant.role !== "owner") {
    redirect(`/${tenant.slug}/checkins`);
  }

  const [gym, staff] = await Promise.all([
    getGymInfo(tenant.id),
    listStaffByGym(tenant.id),
  ]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary">
        Gestiona quién puede acceder al sistema de tu gimnasio y con qué rol.
      </p>

      <div className="pt-4">
        <StaffManager staff={staff} gymNombre={gym?.nombre ?? ""} />
      </div>
    </div>
  );
}
