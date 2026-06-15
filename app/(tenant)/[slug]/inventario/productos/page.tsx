import { getTenant } from "@/lib/tenant";
import { listProductosConStock } from "@/lib/queries/productos.queries";
import { ProductosManager } from "@/components/inventario/ProductosManager";

export default async function ProductosPage() {
  const tenant = await getTenant();
  const productos = await listProductosConStock(tenant.id);

  return <ProductosManager productos={productos} />;
}
