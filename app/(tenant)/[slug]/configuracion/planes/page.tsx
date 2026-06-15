import { getTenant } from "@/lib/tenant";
import { listPlanes } from "@/lib/queries/planes.queries";
import { PlanesManager } from "@/components/configuracion/PlanesManager";

export default async function PlanesPage() {
  const tenant = await getTenant();
  const planes = await listPlanes(tenant.id);

  return <PlanesManager planes={planes} />;
}
