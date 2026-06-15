import { getTenant } from "@/lib/tenant";
import { listPromociones } from "@/lib/queries/promociones.queries";
import { PromocionesManager } from "@/components/configuracion/PromocionesManager";

export default async function PromocionesPage() {
  const tenant = await getTenant();
  const promociones = await listPromociones(tenant.id);

  return <PromocionesManager promociones={promociones} />;
}
