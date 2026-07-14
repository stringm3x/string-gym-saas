import { LuWallet, LuReceipt } from "react-icons/lu";
import {
  listPagosDelDia,
  getResumenCaja,
  type CategoriaCaja,
} from "@/lib/queries/pagos.queries";
import { listPlanes } from "@/lib/queries/planes.queries";
import { listPromociones } from "@/lib/queries/promociones.queries";
import { listProductosParaVenta } from "@/lib/queries/productos.queries";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { formatMoneda } from "@/lib/utils/format";
import {
  getCodigosPendientes,
  limpiarExpirados,
} from "@/lib/queries/kiosco.queries";
import {
  getCorteAbierto,
  resumenCorteEnVivo,
} from "@/lib/queries/cortes.queries";
import { PagoForm } from "@/components/caja/PagoForm";
import { PagosFeed } from "@/components/caja/PagosFeed";
import { CajaFilters } from "@/components/caja/CajaFilters";
import { VisitaRapidaButton } from "@/components/caja/VisitaRapidaButton";
import { CobroMpButton } from "@/components/caja/CobroMpButton";
import { AutorizacionesPendientes } from "@/components/caja/AutorizacionesPendientes";
import { CortePanel } from "@/components/caja/CortePanel";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cat?: string }>;
}

function parseCategoria(value?: string): CategoriaCaja {
  if (
    value === "membresia" ||
    value === "producto" ||
    value === "otros" ||
    value === "visitas"
  )
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

  const canMp = hasFeature(tenant.plan, "mercadopago");
  const canAutoservicio = hasFeature(tenant.plan, "kiosco_autoservicio");

  // Housekeeping: marca como usados los códigos ya expirados.
  if (canAutoservicio) await limpiarExpirados(tenant.id);

  const [
    pagos,
    resumen,
    planes,
    promocionesMembresia,
    promocionesProducto,
    productos,
    gym,
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
    getGymInfo(tenant.id),
  ]);

  const codigosPendientes = canAutoservicio
    ? await getCodigosPendientes(tenant.id)
    : [];

  const corte = await getCorteAbierto(tenant.id);
  const corteTotales = corte
    ? await resumenCorteEnVivo(tenant.id, corte.abierto_at)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
            Caja
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Registra cobros y revisa lo cobrado del día.
          </p>
        </div>
        <VisitaRapidaButton />
      </div>

      {canAutoservicio && (
        <AutorizacionesPendientes codigos={codigosPendientes} />
      )}

      <CortePanel slug={slug} corte={corte} totales={corteTotales} />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* ── Acción: registrar cobro ─────────────────────── */}
        <section className="space-y-4">
          <SectionHeader
            icon={<LuWallet className="h-4 w-4" />}
            title="Registrar cobro"
            subtitle="Cobra membresías, productos o visitas."
            accent
          />
          <div className="rounded-xl border border-brand-green/20 bg-surface p-6">
            <PagoForm
              slug={slug}
              planes={planes}
              promocionesMembresia={promocionesMembresia}
              promocionesProducto={promocionesProducto}
              productos={productos}
            />
          </div>

          {canMp && (
            <CobroMpButton planes={planes} gymNombre={gym?.nombre ?? ""} />
          )}
        </section>

        {/* ── Reporte: cobrado hoy ─────────────────────────── */}
        <section className="space-y-4">
          <SectionHeader
            icon={<LuReceipt className="h-4 w-4" />}
            title="Cobrado hoy"
            subtitle="Totales y movimientos del día."
          />

          <div className="flex justify-end">
            <CajaFilters />
          </div>

          <div className="divide-y divide-border rounded-xl border border-border bg-surface">
            <ResumenRow
              label="Hoy"
              total={formatMoneda(resumen.dia.total)}
              cantidad={resumen.dia.cantidad}
              prominent
            />
            <ResumenRow
              label="Esta semana"
              total={formatMoneda(resumen.semana.total)}
              cantidad={resumen.semana.cantidad}
            />
            <ResumenRow
              label="Este mes"
              total={formatMoneda(resumen.mes.total)}
              cantidad={resumen.mes.cantidad}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Movimientos de hoy
            </h3>
            <PagosFeed pagos={pagos} slug={slug} />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          accent
            ? "bg-brand-green/10 text-brand-green"
            : "bg-surface-hover text-text-secondary"
        }`}
      >
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function ResumenRow({
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
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="text-right">
        <p
          className={`font-mono tabular-nums ${
            prominent
              ? "text-2xl font-bold text-brand-green"
              : "text-base font-semibold text-text-primary"
          }`}
        >
          {total}
        </p>
        <p className="text-[11px] text-text-secondary">
          {cantidad} {cantidad === 1 ? "pago" : "pagos"}
        </p>
      </div>
    </div>
  );
}
