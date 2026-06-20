import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { listMovimientos } from "@/lib/queries/productos.queries";
import { MovimientosList } from "@/components/inventario/MovimientosList";
import { AccessDenied } from "@/components/ui/AccessDenied";

export default async function MovimientosPage() {
  const tenant = await getTenant();

  if (!hasPermission(tenant.role, "ver_inventario_movimientos")) {
    return <AccessDenied slug={tenant.slug} />;
  }

  const movimientos = await listMovimientos(tenant.id, undefined, 100);

  return <MovimientosList movimientos={movimientos} />;
}
