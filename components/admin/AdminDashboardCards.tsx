import type { AdminDashboardMetrics } from "@/lib/queries/admin.queries";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "warning" | "danger";
}) {
  const valueColor =
    accent === "green"
      ? "text-brand-green"
      : accent === "warning"
        ? "text-warning"
        : accent === "danger"
          ? "text-danger"
          : "text-text-primary";
  return (
    <div className="flex flex-col gap-2.5 border border-border bg-surface p-5">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        {label}
      </p>
      <p className={`font-mono text-cifra font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
      {hint && <p className="text-sm text-text-muted">{hint}</p>}
    </div>
  );
}

export function AdminDashboardCards({
  metrics,
}: {
  metrics: AdminDashboardMetrics;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Card
        label="Gimnasios activos"
        value={String(metrics.activos)}
        accent="green"
      />
      <Card
        label="En prueba"
        value={String(metrics.prueba)}
        hint={
          metrics.pruebaDiasPromedio !== null
            ? `~${metrics.pruebaDiasPromedio} días restantes prom.`
            : undefined
        }
        accent="warning"
      />
      <Card
        label="Suspendidos"
        value={String(metrics.suspendidos)}
        accent={metrics.suspendidos > 0 ? "danger" : undefined}
      />
      <Card
        label="MRR estimado"
        value={MXN.format(metrics.mrrTotal)}
        hint="suma de activos"
        accent="green"
      />
      <Card
        label="Nuevos este mes"
        value={String(metrics.nuevosEsteMes)}
      />
      <Card
        label="Rotación este mes"
        value={String(metrics.churnEsteMes)}
        hint="cancelaciones"
        accent={metrics.churnEsteMes > 0 ? "danger" : undefined}
      />
    </div>
  );
}
