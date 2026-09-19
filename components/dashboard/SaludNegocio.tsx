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
      label: "Rotación",
      valor: `${(metricas.churnRate * 100).toFixed(1)}%`,
      hint: "Bajas últimos 30 días",
    },
  ];

  return (
    <section className="card-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <LuHeartPulse className="h-4 w-4 text-brand-green" aria-hidden="true" />
          Salud del negocio
        </h3>
        <Link
          href={`/${slug}/reportes/financiero`}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary underline-offset-4 transition-colors hover:text-brand-green hover:underline"
        >
          <LuFileText className="h-4 w-4" aria-hidden="true" /> Reporte
          financiero
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="border border-border bg-bg p-4">
            <p className="font-mono text-etiqueta uppercase text-text-secondary">
              {it.label}
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-text-primary">
              {it.valor}
            </p>
            <p className="mt-1 text-xs text-text-muted">{it.hint}</p>
          </div>
        ))}
      </div>

      <p className="px-5 pb-5 text-xs text-text-muted">
        Estimaciones sobre los datos actuales. El MRR considera solo planes por
        tiempo con plan asignado.
      </p>
    </section>
  );
}
