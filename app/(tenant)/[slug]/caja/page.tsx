import { listPagosDelDia, getResumenDia } from "@/lib/queries/pagos.queries";
import { getTenant } from "@/lib/tenant";
import { formatMoneda } from "@/lib/utils/format";
import { PagoForm } from "@/components/caja/PagoForm";
import { PagosFeed } from "@/components/caja/PagosFeed";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CajaPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  const [pagos, resumen] = await Promise.all([
    listPagosDelDia(tenant.id, 50),
    getResumenDia(tenant.id),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
            Caja
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Registra pagos de membresías, visitas, productos y otros conceptos.
          </p>
        </div>

        <div className="flex gap-3">
          <ResumenCard
            label="Total hoy"
            value={formatMoneda(resumen.total)}
            prominent
          />
          <ResumenCard label="Pagos" value={resumen.cantidad.toString()} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-border bg-surface p-6">
          <PagoForm />
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
  value,
  prominent = false,
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-mono tabular-nums ${
          prominent
            ? "text-2xl font-bold text-brand-green"
            : "text-lg font-semibold text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
