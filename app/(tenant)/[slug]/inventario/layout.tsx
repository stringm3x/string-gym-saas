import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { countStockBajo } from "@/lib/queries/productos.queries";
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
  const g = await requirePanel("pagina.inventario", { sinPermiso: "/checkins" });
  const tenant = g.ctx;

  if (!g.ok) {
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
        planRequerido={g.planRequerido}
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const stockBajoCount = await countStockBajo(tenant.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-pagina text-text-primary font-semibold">
          Inventario
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Administra productos, stock y movimientos de inventario.
        </p>
      </div>

      <InventarioTabs
        slug={slug}
        stockBajoCount={stockBajoCount}
        canMovimientos={tenant.can("ver_inventario_movimientos")}
      />

      <div>{children}</div>
    </div>
  );
}
