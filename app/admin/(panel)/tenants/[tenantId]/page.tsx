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
import { Badge } from "@/components/ui/Badge";
import { TenantActionsPanel } from "@/components/admin/TenantActionsPanel";
import { TenantEstadoBadge } from "@/components/admin/TenantsTable";
import { PagosManualesTable } from "@/components/admin/PagosManualesTable";
import { NotasInternas } from "@/components/admin/NotasInternas";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { TZ_MX } from "@/lib/utils/dates";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function fecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Fecha numérica corta para la tarjeta de cifra (cabe a 40px mono).
function fechaNumerica(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2.5 border border-border bg-surface p-5">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        {label}
      </p>
      <p className="font-mono text-cifra font-bold tabular-nums text-text-primary">
        {value}
      </p>
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
    <div className="flex flex-col gap-7">
      {/* Encabezado */}
      <div className="flex flex-col gap-1.5">
        <Link
          href="/admin/tenants"
          className="inline-flex h-9 items-center gap-1.5 self-start font-mono text-etiqueta uppercase text-text-muted transition-colors hover:text-text-primary"
        >
          <LuArrowLeft className="h-3.5 w-3.5" /> Gimnasios
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-pagina font-semibold text-text-primary">
            {tenant.nombre}
          </h1>
          <TenantEstadoBadge estado={tenant.estado} />
          {tenant.es_fundador && (
            <Badge variant="warning">
              <LuStar className="h-3 w-3" /> Fundador
            </Badge>
          )}
        </div>
        <p className="text-sm text-text-secondary">
          <span className="font-mono">/{tenant.slug}</span> ·{" "}
          {PLAN_LABEL[tenant.plan as Plan] ?? tenant.plan} ·{" "}
          <span className="font-mono tabular-nums">{MXN.format(tenant.mrr)}</span>
          /mes · alta{" "}
          <span className="font-mono tabular-nums">{fecha(tenant.created_at)}</span>
        </p>
        <p className="text-sm text-text-muted">
          Dueño: {tenant.owner_email ?? "—"}
          {tenant.telefono && (
            <>
              {" · Tel: "}
              <span className="font-mono tabular-nums">{tenant.telefono}</span>
            </>
          )}
          {tenant.estado === "prueba" && tenant.prueba_hasta && (
            <>
              {" · Prueba hasta "}
              <span className="font-mono tabular-nums">
                {fecha(tenant.prueba_hasta)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Cifras */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Miembros" value={String(metrics.miembros)} />
        <Metric label="Prospectos" value={String(metrics.prospectos)} />
        <Metric label="Pagos 30 días" value={MXN.format(metrics.pagosUltimoMes)} />
        <Metric
          label="Último check-in"
          value={
            metrics.ultimoCheckin ? fechaNumerica(metrics.ultimoCheckin) : "—"
          }
        />
      </div>

      {/* Acciones + paneles */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-text-primary">
            Acciones administrativas
          </h2>
          <TenantActionsPanel tenant={tenant} addons={addons} />
        </div>

        <div className="flex flex-col gap-4">
          <PagosManualesTable tenantId={tenantId} pagos={pagos} />
          <NotasInternas tenantId={tenantId} notas={notas} />
          <section className="card-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-text-primary">
                Bitácora del gimnasio
              </h3>
              <span className="font-mono text-etiqueta tabular-nums text-text-muted">
                {events.length}
              </span>
            </div>
            <AuditLogTable events={events} />
          </section>
        </div>
      </div>
    </div>
  );
}
