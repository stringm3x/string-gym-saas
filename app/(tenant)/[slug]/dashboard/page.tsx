import { getTenant } from "@/lib/tenant";
import { PLAN_LABELS } from "@/lib/features";

export default async function DashboardPage() {
  const tenant = await getTenant();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Bienvenido al panel — plan {PLAN_LABELS[tenant.plan]}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-text-secondary">
          Sin datos todavía. Cuando agregues miembros y registres pagos, las
          métricas aparecerán aquí.
        </p>
      </div>
    </div>
  );
}
