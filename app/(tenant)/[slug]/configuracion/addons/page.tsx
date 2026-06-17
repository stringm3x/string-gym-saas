import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listGymAddons } from "@/lib/queries/addons.queries";
import { AddonsManager } from "@/components/configuracion/AddonsManager";

export default async function AddonsPage() {
  const tenant = await getTenant();
  const [gym, addons] = await Promise.all([
    getGymInfo(tenant.id),
    listGymAddons(tenant.id),
  ]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary">
        Funcionalidades extra para tu gimnasio. Se contratan aparte y puedes
        tener varias activas al mismo tiempo.
      </p>

      <div className="pt-4">
        <AddonsManager
          addonsActivos={addons}
          planActual={tenant.plan}
          gymNombre={gym?.nombre ?? ""}
        />
      </div>
    </div>
  );
}
