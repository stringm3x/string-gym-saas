import {
  listPagosDelDia,
  getResumenCaja,
  type CategoriaCaja,
} from "@/lib/queries/pagos.queries";
import { listPlanes } from "@/lib/queries/planes.queries";
import { listPromociones } from "@/lib/queries/promociones.queries";
import { listProductosParaVenta } from "@/lib/queries/productos.queries";
import { getTenant } from "@/lib/tenant";
import { formatMoneda } from "@/lib/utils/format";
import { PagoForm } from "@/components/caja/PagoForm";
import { PagosFeed } from "@/components/caja/PagosFeed";
import { CajaFilters } from "@/components/caja/CajaFilters";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cat?: string }>;
}

function parseCategoria(value?: string): CategoriaCaja {
  if (value === "membresia" || value === "producto" || value === "otros")
    return value;
  return "all";
}

export default async function CajaPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp, tenant] = await Promise.all([
    params,
    searchParams,
    getTenant(),
  ]);

  const categoria = parseCategoria(sp.cat);

  const [
    pagos,
    resumen,
    planes,
    promocionesMembresia,
    promocionesProducto,
    productos,
  ] = await Promise.all([
    listPagosDelDia(tenant.id, categoria, 50),
    getResumenCaja(tenant.id, categoria),
    listPlanes(tenant.id, { soloActivos: true }),
    listPromociones(tenant.id, {
      soloActivasVigentes: true,
      tipo: "membresia",
    }),
    listPromociones(tenant.id, { soloActivasVigentes: true, tipo: "producto" }),
    listProductosParaVenta(tenant.id),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
            Caja
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Registra pagos y revisa totales por día, semana y mes.
          </p>
        </div>
        <CajaFilters />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ResumenCard
          label="Hoy"
          total={formatMoneda(resumen.dia.total)}
          cantidad={resumen.dia.cantidad}
          prominent
        />
        <ResumenCard
          label="Esta semana"
          total={formatMoneda(resumen.semana.total)}
          cantidad={resumen.semana.cantidad}
        />
        <ResumenCard
          label="Este mes"
          total={formatMoneda(resumen.mes.total)}
          cantidad={resumen.mes.cantidad}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-border bg-surface p-6">
          <PagoForm
            slug={slug}
            planes={planes}
            promocionesMembresia={promocionesMembresia}
            promocionesProducto={promocionesProducto}
            productos={productos}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Pagos de hoy
          </h3>
          <PagosFeed pagos={pagos} slug={slug} />
        </div>
      </div>
    </div>
  );
}

function ResumenCard({
  label,
  total,
  cantidad,
  prominent = false,
}: {
  label: string;
  total: string;
  cantidad: number;
  prominent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-mono tabular-nums ${
          prominent
            ? "text-3xl font-bold text-brand-green"
            : "text-xl font-semibold text-text-primary"
        }`}
      >
        {total}
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        {cantidad} {cantidad === 1 ? "pago" : "pagos"}
      </p>
    </div>
  );
}
