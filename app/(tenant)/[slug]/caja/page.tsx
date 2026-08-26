import Link from "next/link";
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
import { getGymFull } from "@/lib/queries/gyms.queries";
import { listStaffParaCheckin } from "@/lib/queries/staff.queries";
import { listCajas } from "@/lib/queries/cajas.queries";
import { formatMoneda } from "@/lib/utils/format";
import { hoyCDMX } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import {
  getCodigosPendientes,
  limpiarExpirados,
} from "@/lib/queries/kiosco.queries";
import {
  getCorteAbierto,
  resumenCorteEnVivo,
  resumenCorteEnVivoPorConcepto,
  listCajasAbiertas,
} from "@/lib/queries/cortes.queries";
import { listPagosExternosPendientes } from "@/lib/queries/mercadopago.queries";
import { CobroSwitcher } from "@/components/caja/CobroSwitcher";
import { PagosFeed } from "@/components/caja/PagosFeed";
import { CajaFilters } from "@/components/caja/CajaFilters";
import { VisitaRapidaButton } from "@/components/caja/VisitaRapidaButton";
import { CobroMpButton } from "@/components/caja/CobroMpButton";
import { AutorizacionesPendientes } from "@/components/caja/AutorizacionesPendientes";
import { PagosExternosPendientes } from "@/components/caja/PagosExternosPendientes";
import { CortePanel } from "@/components/caja/CortePanel";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cat?: string; caja?: string }>;
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
    cajas,
    planes,
    promocionesMembresia,
    promocionesProducto,
    productos,
    gym,
  ] = await Promise.all([
    listCajas(tenant.id),
    listPlanes(tenant.id, { soloActivos: true }),
    listPromociones(tenant.id, {
      soloActivasVigentes: true,
      tipo: "membresia",
    }),
    listPromociones(tenant.id, { soloActivasVigentes: true, tipo: "producto" }),
    listProductosParaVenta(tenant.id),
    getGymFull(tenant.id),
  ]);

  // Fallback defensivo: todo gym tiene al menos una caja default por
  // backfill (sql/063_cajas_multiples.sql), pero si por lo que sea no la
  // tuviera, evita romper la página entera.
  const cajaActiva =
    cajas.find((c) => c.id === sp.caja) ??
    cajas.find((c) => c.es_default) ??
    cajas[0] ??
    null;

  const [
    pagos,
    resumen,
    codigosPendientes,
    pagosMpPendientes,
    cajasAbiertas,
  ] = await Promise.all([
    cajaActiva
      ? listPagosDelDia(tenant.id, categoria, 50, cajaActiva.id)
      : Promise.resolve([]),
    cajaActiva
      ? getResumenCaja(tenant.id, categoria, cajaActiva.id)
      : Promise.resolve({
          dia: { total: 0, cantidad: 0 },
          semana: { total: 0, cantidad: 0 },
          mes: { total: 0, cantidad: 0 },
        }),
    canAutoservicio ? getCodigosPendientes(tenant.id) : Promise.resolve([]),
    canMp ? listPagosExternosPendientes(tenant.id) : Promise.resolve([]),
    cajas.length > 1 ? listCajasAbiertas(tenant.id) : Promise.resolve([]),
  ]);

  const cajaRequiereCuadre = cajaActiva?.requiere_cuadre ?? false;
  const checkinRequerido = (gym?.caja_checkin_pin ?? false) && cajaRequiereCuadre;
  const [corte, staffParaCheckin] = await Promise.all([
    cajaActiva && cajaRequiereCuadre
      ? getCorteAbierto(tenant.id, cajaActiva.id)
      : Promise.resolve(null),
    checkinRequerido ? listStaffParaCheckin(tenant.id) : Promise.resolve([]),
  ]);

  let corteTotales: Awaited<ReturnType<typeof resumenCorteEnVivo>> | null = null;
  let corteTotalesPorConcepto: Awaited<
    ReturnType<typeof resumenCorteEnVivoPorConcepto>
  > | null = null;
  if (cajaActiva && cajaRequiereCuadre && corte) {
    [corteTotales, corteTotalesPorConcepto] = await Promise.all([
      resumenCorteEnVivo(tenant.id, corte.caja_id, corte.abierto_at),
      resumenCorteEnVivoPorConcepto(tenant.id, corte.caja_id, corte.abierto_at),
    ]);
  } else if (cajaActiva && !cajaRequiereCuadre) {
    // Sin turno: "hoy" es simplemente desde la medianoche de México.
    const desdeHoy = hoyCDMX().toISOString();
    [corteTotales, corteTotalesPorConcepto] = await Promise.all([
      resumenCorteEnVivo(tenant.id, cajaActiva.id, desdeHoy),
      resumenCorteEnVivoPorConcepto(tenant.id, cajaActiva.id, desdeHoy),
    ]);
  }

  const totalPorCaja = new Map(
    cajasAbiertas.map((c) => [c.cajaId, c.totalCobrado])
  );

  function hrefCaja(cajaId: string): string {
    const params = new URLSearchParams();
    if (sp.cat) params.set("cat", sp.cat);
    params.set("caja", cajaId);
    return `/${slug}/caja?${params.toString()}`;
  }

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

      {cajas.length > 1 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
            {cajas.map((c) => {
              const activa = cajaActiva?.id === c.id;
              const total = totalPorCaja.get(c.id);
              return (
                <Link
                  key={c.id}
                  href={hrefCaja(c.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                    activa
                      ? "bg-bg text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {c.nombre}
                  {total !== undefined && (
                    <span
                      className={cn(
                        "ml-1.5",
                        activa ? "text-brand-green" : "text-text-muted"
                      )}
                    >
                      · {formatMoneda(total)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <p className="text-xs text-text-muted">
            No hace falta que cambies de pestaña para cobrar bien — cada
            producto ya sabe a qué caja pertenece. Las pestañas son solo
            para ver el corte de cada una.
          </p>
        </div>
      )}

      {canAutoservicio && (
        <AutorizacionesPendientes codigos={codigosPendientes} />
      )}

      {cajaActiva ? (
        <CortePanel
          slug={slug}
          cajaId={cajaActiva.id}
          nombreCaja={cajaActiva.nombre}
          requiereCuadre={cajaRequiereCuadre}
          corte={corte}
          totales={corteTotales}
          totalesPorConcepto={corteTotalesPorConcepto}
          checkinRequerido={checkinRequerido}
          staffParaCheckin={staffParaCheckin}
        />
      ) : (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          No hay ninguna caja configurada — algo salió mal al crear tu gym.
          Contacta soporte.
        </p>
      )}

      {cajaActiva && (
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* ── Acción: registrar cobro ─────────────────────── */}
          <section className="space-y-4">
            <SectionHeader
              icon={<LuWallet className="h-4 w-4" />}
              title="Registrar cobro"
              subtitle="Cobra membresías, productos o visitas."
              accent
            />
            <CobroSwitcher
              slug={slug}
              planes={planes}
              promocionesMembresia={promocionesMembresia}
              promocionesProducto={promocionesProducto}
              productos={productos}
            />

            {canMp && (
              <CobroMpButton planes={planes} gymNombre={gym?.nombre ?? ""} />
            )}
          </section>

          {/* ── Reporte: cobrado hoy ─────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader
              icon={<LuReceipt className="h-4 w-4" />}
              title="Cobrado hoy"
              subtitle={
                cajas.length > 1
                  ? `Totales y movimientos de ${cajaActiva.nombre}.`
                  : "Totales y movimientos del día."
              }
            />

            <div className="flex justify-end">
              <CajaFilters />
            </div>

            {canMp && <PagosExternosPendientes pendientes={pagosMpPendientes} />}

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
      )}
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
