import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { countStockBajo } from "@/lib/queries/productos.queries";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { InventarioTabs } from "@/components/inventario/InventarioTabs";
import { UpgradePage } from "@/components/ui/UpgradePage";

export default async function InventarioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "inventario")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Inventario"
        descripcion="Administra productos, stock y movimientos, y véndelos desde caja."
        beneficios={[
          "Catálogo de productos con control de stock",
          "Alertas de stock bajo",
          "Venta de productos integrada a la caja",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const stockBajoCount = await countStockBajo(tenant.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Inventario
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Administra productos, stock y movimientos de inventario.
        </p>
      </div>

      <InventarioTabs
        slug={slug}
        stockBajoCount={stockBajoCount}
        canMovimientos={hasPermission(tenant.role, "ver_inventario_movimientos")}
      />

      <div>{children}</div>
    </div>
  );
}
