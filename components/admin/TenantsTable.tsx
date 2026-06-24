import Link from "next/link";
import type { AdminTenantRow } from "@/lib/queries/admin.queries";
import { PLAN_LABEL } from "@/lib/admin/pricing";
import type { Plan } from "@/lib/features";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const ESTADO_STYLE: Record<string, string> = {
  activo: "border-brand-green/30 bg-brand-green/10 text-brand-green",
  prueba: "border-warning/30 bg-warning/10 text-warning",
  suspendido: "border-danger/30 bg-danger/10 text-danger",
  cancelado: "border-border bg-bg text-text-muted",
};

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TenantsTable({ rows }: { rows: AdminTenantRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-text-secondary">
        No hay tenants que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3 font-medium">Gym</th>
            <th className="px-4 py-3 font-medium">Owner</th>
            <th className="px-4 py-3 font-medium">Plan</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Registro</th>
            <th className="px-4 py-3 text-right font-medium">Días</th>
            <th className="px-4 py-3 text-right font-medium">MRR</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-border last:border-0 bg-bg/40 hover:bg-surface"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-text-primary">{r.nombre}</div>
                <div className="text-xs text-text-muted">/{r.slug}</div>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {r.owner_email ?? "—"}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {PLAN_LABEL[r.plan as Plan] ?? r.plan}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                    ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.cancelado
                  }`}
                >
                  {r.estado}
                </span>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {fechaCorta(r.created_at)}
              </td>
              <td className="px-4 py-3 text-right text-text-secondary">
                {r.dias_en_plataforma}
              </td>
              <td className="px-4 py-3 text-right text-text-primary">
                {MXN.format(r.mrr)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/tenants/${r.id}`}
                  className="text-xs font-medium text-brand-green hover:underline"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
