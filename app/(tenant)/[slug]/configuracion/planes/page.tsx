import { requirePanel } from "@/lib/authz/pagina";
import { listPlanes } from "@/lib/queries/planes.queries";
import { PlanesManager } from "@/components/configuracion/PlanesManager";

export default async function PlanesPage() {
  // Misma política que createPlanAction: catálogo (Starter) + configurar_planes_promociones.
  // Antes solo gateaba el layout (configurar_general) y un gerente veía la
  // pantalla con todos los guardados fallando.
  const g = await requirePanel("config.plan_crear", { sinPermiso: "/configuracion/gym" });
  if (!g.ok) return null; // catalogo_planes es Starter: no ocurre
  const planes = await listPlanes(g.ctx.id);

  return <PlanesManager planes={planes} />;
}
