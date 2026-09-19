import Link from "next/link";
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
import { hoyCDMX, TZ_MX } from "@/lib/utils/dates";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { LuStore, LuTriangleAlert } from "react-icons/lu";

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

function horaMX(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_MX,
  }).format(new Date(iso));
}

function fechaHoy(): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ_MX,
  }).format(new Date());
}

/**
 * Caja (artboard "Caja"): a la izquierda la tarjeta "Registrar cobro"; a la
 * derecha los totales por método, el turno y los movimientos. Verde solo en
 * el botón de cobrar y en el método seleccionado.
 */
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

  // Kicker: el estado del turno cuando la caja cuadra; la fecha si no.
  // Dice "Turno desde" y no "Turno abierto" para no duplicar el texto del
  // toast que la prueba E2E de caja espera encontrar una sola vez.
  const kicker = corte
    ? `Turno desde ${horaMX(corte.abierto_at)}${
        corte.abierto_por_nombre ? ` · ${corte.abierto_por_nombre}` : ""
      }`
    : cajaRequiereCuadre
      ? "Sin turno abierto"
      : fechaHoy();

  const tituloMovimientos = corte ? "Movimientos del turno" : "Movimientos de hoy";

  return (
    <div className="flex flex-col gap-7">
      {/* Encabezado: kicker del turno en mono, título en Geist, acciones */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            {kicker}
          </p>
          <h2 className="text-pagina font-semibold text-text-primary">Caja</h2>
        </div>
        <div className="flex items-center gap-3">
          {cajaRequiereCuadre && (
            <Link
              href={`/${slug}/caja/cortes`}
              className="inline-flex h-11 items-center gap-2 border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary"
            >
              Cortes
            </Link>
          )}
          <VisitaRapidaButton />
        </div>
      </div>

      {cajas.length > 1 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {cajas.map((c) => {
              const activa = cajaActiva?.id === c.id;
              const total = totalPorCaja.get(c.id);
              return (
                <Link
                  key={c.id}
                  href={hrefCaja(c.id)}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 border px-4 text-sm transition-colors",
                    activa
                      ? "border-brand-green bg-surface-hover text-brand-green"
                      : "border-border bg-surface text-text-secondary hover:border-text-secondary hover:text-text-primary"
                  )}
                >
                  {c.nombre}
                  {total !== undefined && (
                    <span className="font-mono text-dato tabular-nums">
                      {formatMoneda(total)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <p className="text-sm text-text-muted">
            Cada producto ya sabe a qué caja pertenece: las pestañas solo
            cambian qué corte ves.
          </p>
        </div>
      )}

      {canAutoservicio && (
        <AutorizacionesPendientes codigos={codigosPendientes} />
      )}

      {!cajaActiva && (
        <EmptyState
          icon={<LuStore />}
          title="Sin caja configurada"
          description={
            tenant.role === "owner"
              ? "Para cobrar necesitas al menos una caja. Créala en Configuración → Cajas y regresa aquí."
              : "Para cobrar hace falta una caja configurada. Pídele al dueño que la cree en Configuración → Cajas."
          }
          action={
            tenant.role === "owner" ? (
              <Link
                href={`/${slug}/configuracion/cajas`}
                className="inline-flex h-11 items-center gap-2 bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
              >
                Configurar cajas
              </Link>
            ) : undefined
          }
        />
      )}

      {cajaActiva && cajaRequiereCuadre && !corte && (
        <div className="flex items-start gap-3 border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-primary">
          <LuTriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p>
            Esta caja no tiene turno activo ahorita. Lo que cobres{" "}
            <strong>no va a entrar al corte</strong>. Ábrelo en el panel de
            la derecha, o cobra igual y cuádralo a mano después.
          </p>
        </div>
      )}

      {cajaActiva && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          {/* ── Registrar cobro ─────────────────────────────── */}
          <div className="flex flex-col gap-4">
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
          </div>

          {/* ── Totales, turno y movimientos ────────────────── */}
          <div className="flex flex-col gap-4">
            {corteTotales && (
              <div className="grid grid-cols-3 gap-4">
                <TotalMetodo label="Efectivo" valor={corteTotales.efectivo} />
                <TotalMetodo label="Tarjeta" valor={corteTotales.tarjeta} />
                <TotalMetodo
                  label="Transferencia"
                  valor={corteTotales.transferencia}
                />
              </div>
            )}

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

            {canMp && <PagosExternosPendientes pendientes={pagosMpPendientes} />}

            <section className="card-surface">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold text-text-primary">
                  {tituloMovimientos}
                </h3>
                <span className="font-mono text-etiqueta text-text-muted">
                  {pagos.length}
                </span>
              </div>
              <div className="border-b border-border px-5 py-3">
                <CajaFilters />
              </div>
              <PagosFeed pagos={pagos} slug={slug} />
            </section>

            <section className="card-surface">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold text-text-primary">
                  Cobrado
                </h3>
                {cajas.length > 1 && (
                  <span className="font-mono text-etiqueta uppercase text-text-muted">
                    {cajaActiva.nombre}
                  </span>
                )}
              </div>
              <ul className="divide-y divide-border">
                <ResumenRow
                  label="Hoy"
                  total={formatMoneda(resumen.dia.total)}
                  cantidad={resumen.dia.cantidad}
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
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tarjeta de total por método: etiqueta en mono y cifra en mono 26px. */
function TotalMetodo({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card-surface flex flex-col gap-2 p-4">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        {label}
      </p>
      <p className="font-mono text-[26px] font-bold leading-8 tabular-nums text-text-primary">
        {formatMoneda(valor)}
      </p>
    </div>
  );
}

function ResumenRow({
  label,
  total,
  cantidad,
}: {
  label: string;
  total: string;
  cantidad: number;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[15px] leading-5 text-text-primary">{label}</p>
        <p className="mt-0.5 text-sm text-text-muted">
          {cantidad} {cantidad === 1 ? "cobro" : "cobros"}
        </p>
      </div>
      <span className="shrink-0 font-mono text-dato tabular-nums text-text-primary">
        {total}
      </span>
    </li>
  );
}
