import { getTenant } from "@/lib/tenant";
import { listProductosConStock } from "@/lib/queries/productos.queries";
import { listCajas } from "@/lib/queries/cajas.queries";
import { ProductosManager } from "@/components/inventario/ProductosManager";

export default async function ProductosPage() {
  const tenant = await getTenant();
  const [productos, cajas] = await Promise.all([
    listProductosConStock(tenant.id),
    listCajas(tenant.id),
  ]);

  return <ProductosManager productos={productos} cajas={cajas} />;
}
