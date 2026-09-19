import Link from "next/link";
import type { AdminTenantRow } from "@/lib/queries/admin.queries";
import { PLAN_LABEL } from "@/lib/admin/pricing";
import type { Plan } from "@/lib/features";
import { TZ_MX } from "@/lib/utils/dates";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LuSearch } from "react-icons/lu";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const ESTADO_VARIANT: Record<string, BadgeVariant> = {
  activo: "success",
  prueba: "warning",
  suspendido: "danger",
  cancelado: "neutral",
};

/** Chip de estado del gimnasio (activo / prueba / suspendido / cancelado). */
export function TenantEstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge variant={ESTADO_VARIANT[estado] ?? "neutral"}>{estado}</Badge>
  );
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TH = "px-4 py-3 font-normal";

export function TenantsTable({ rows }: { rows: AdminTenantRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<LuSearch />}
        title="Sin gimnasios"
        description="Ningún gimnasio coincide con la búsqueda o los filtros."
      />
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-etiqueta uppercase text-text-muted">
            <th className={TH}>Gimnasio</th>
            <th className={TH}>Dueño</th>
            <th className={TH}>Plan</th>
            <th className={TH}>Estado</th>
            <th className={TH}>Registro</th>
            <th className={`${TH} text-right`}>Días</th>
            <th className={`${TH} text-right`}>MRR</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-surface-hover/60">
              <td className="px-4 py-3">
                <div className="font-medium text-text-primary">{r.nombre}</div>
                <div className="font-mono text-xs text-text-muted">/{r.slug}</div>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {r.owner_email ?? "—"}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {PLAN_LABEL[r.plan as Plan] ?? r.plan}
              </td>
              <td className="px-4 py-3">
                <TenantEstadoBadge estado={r.estado} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-dato tabular-nums text-text-secondary">
                {fechaCorta(r.created_at)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-dato tabular-nums text-text-secondary">
                {r.dias_en_plataforma}
              </td>
              <td className="px-4 py-3 text-right font-mono text-dato tabular-nums text-text-primary">
                {MXN.format(r.mrr)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/tenants/${r.id}`}
                  className="inline-flex h-9 items-center px-2 text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
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
