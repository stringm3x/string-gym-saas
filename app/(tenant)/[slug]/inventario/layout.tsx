import { getTenant } from "@/lib/tenant";
import { countStockBajo } from "@/lib/queries/productos.queries";
import { InventarioTabs } from "@/components/inventario/InventarioTabs";

export default async function InventarioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenant();
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

      <InventarioTabs slug={slug} stockBajoCount={stockBajoCount} />

      <div>{children}</div>
    </div>
  );
}
