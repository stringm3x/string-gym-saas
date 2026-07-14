import Link from "next/link";
import { LuHeartPulse, LuFileText } from "react-icons/lu";
import { formatMoneda } from "@/lib/utils/format";
import type { MetricasNegocio } from "@/lib/queries/negocio.queries";

export function SaludNegocio({
  metricas,
  slug,
}: {
  metricas: MetricasNegocio;
  slug: string;
}) {
  const items = [
    { label: "MRR", valor: formatMoneda(metricas.mrr), hint: "Ingreso mensual recurrente" },
    { label: "ARPU", valor: formatMoneda(metricas.arpu), hint: "Ingreso por socio activo" },
    { label: "LTV", valor: formatMoneda(metricas.ltv), hint: "Valor de vida del socio" },
    {
      label: "Churn",
      valor: `${(metricas.churnRate * 100).toFixed(1)}%`,
      hint: "Bajas últimos 30 días",
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <LuHeartPulse className="h-4 w-4 text-brand-green" />
          Salud del negocio
        </h3>
        <Link
          href={`/${slug}/reportes/financiero`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-brand-green"
        >
          <LuFileText className="h-3.5 w-3.5" /> Reporte financiero
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg border border-border bg-bg p-3">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">
              {it.label}
            </p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-text-primary">
              {it.valor}
            </p>
            <p className="mt-0.5 text-[11px] text-text-secondary">{it.hint}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-text-muted">
        Estimaciones sobre los datos actuales. El MRR considera solo planes por
        tiempo con plan asignado.
      </p>
    </section>
  );
}
