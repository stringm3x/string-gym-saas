import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft, LuStar } from "react-icons/lu";
import {
  getTenantDetailAdmin,
  getTenantMetrics,
  getTenantAddons,
  listTenantNotas,
  listTenantPagosManuales,
  getTenantAdminEvents,
} from "@/lib/queries/admin.queries";
import { PLAN_LABEL } from "@/lib/admin/pricing";
import type { Plan } from "@/lib/features";
import { TenantActionsPanel } from "@/components/admin/TenantActionsPanel";
import { PagosManualesTable } from "@/components/admin/PagosManualesTable";
import { NotasInternas } from "@/components/admin/NotasInternas";
import { AuditLogTable } from "@/components/admin/AuditLogTable";

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

function fecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantDetailAdmin(tenantId);
  if (!tenant) notFound();

  const [metrics, addons, notas, pagos, events] = await Promise.all([
    getTenantMetrics(tenantId),
    getTenantAddons(tenantId),
    listTenantNotas(tenantId),
    listTenantPagosManuales(tenantId),
    getTenantAdminEvents(tenantId),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
      >
        <LuArrowLeft className="h-3.5 w-3.5" /> Tenants
      </Link>

      {/* Info general */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">
            {tenant.nombre}
          </h1>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
              ESTADO_STYLE[tenant.estado] ?? ESTADO_STYLE.cancelado
            }`}
          >
            {tenant.estado}
          </span>
          {tenant.es_fundador && (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              <LuStar className="h-3 w-3" /> Fundador
            </span>
          )}
        </div>
        <p className="text-sm text-text-secondary">
          /{tenant.slug} · {PLAN_LABEL[tenant.plan as Plan] ?? tenant.plan} ·{" "}
          {MXN.format(tenant.mrr)}/mes · alta {fecha(tenant.created_at)}
        </p>
        <p className="text-xs text-text-muted">
          Owner: {tenant.owner_email ?? "—"}
          {tenant.telefono && ` · Tel: ${tenant.telefono}`}
          {tenant.dominio_custom && ` · Dominio: ${tenant.dominio_custom}`}
          {tenant.estado === "prueba" &&
            tenant.prueba_hasta &&
            ` · Prueba hasta ${fecha(tenant.prueba_hasta)}`}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Miembros" value={String(metrics.miembros)} />
        <Metric label="Prospectos" value={String(metrics.prospectos)} />
        <Metric label="Pagos 30d" value={MXN.format(metrics.pagosUltimoMes)} />
        <Metric
          label="Último check-in"
          value={
            metrics.ultimoCheckin
              ? fecha(metrics.ultimoCheckin)
              : "—"
          }
        />
      </div>

      {/* Acciones + paneles */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Acciones administrativas
          </h2>
          <TenantActionsPanel tenant={tenant} addons={addons} />
        </div>

        <div className="space-y-6">
          <PagosManualesTable tenantId={tenantId} pagos={pagos} />
          <NotasInternas tenantId={tenantId} notas={notas} />
          <div>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Audit log del tenant
            </h3>
            <AuditLogTable events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
