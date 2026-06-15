import { getTenant } from "@/lib/tenant";
import { listMovimientos } from "@/lib/queries/productos.queries";
import { MovimientosList } from "@/components/inventario/MovimientosList";

export default async function MovimientosPage() {
  const tenant = await getTenant();
  const movimientos = await listMovimientos(tenant.id, undefined, 100);

  return <MovimientosList movimientos={movimientos} />;
}
