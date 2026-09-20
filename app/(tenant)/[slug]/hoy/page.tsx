import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePanel } from "@/lib/authz/pagina";
import { getAlertas } from "@/lib/queries/alertas.queries";
import { countMiembrosSinTelefono } from "@/lib/queries/miembros.queries";
import { getPromedioSemana } from "@/lib/queries/opiniones.queries";
import { getCheckinsStats } from "@/lib/queries/dashboard.queries";
import { getIngresosStats } from "@/lib/queries/dashboard.queries";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { getSesionesByRango } from "@/lib/queries/clases.queries";
import { hoyYMD } from "@/lib/utils/clases-format";
import { StatCard } from "@/components/dashboard/StatCard";
import { AlertasList } from "@/components/alertas/AlertasList";
import { ClasesHoy } from "@/components/clases/ClasesHoy";
import type { ClaseSesion } from "@/lib/types/clases";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function formatFechaHoy(): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

/**
 * Panel del día (artboard "Panel del día"): lo que el dueño abre cada
 * mañana. Kicker con la fecha, cuatro cifras, puntos de atención y clases.
 * Densidad y ritmo: sin cartel.
 */
export default async function HoyPage({ params }: PageProps) {
  const { slug } = await params;
  // Hoy es panel estratégico del dueño — el recepcionista va a check-ins.
  const g = await requirePanel("pagina.hoy", { sinPermiso: "/checkins" });
  // pantalla_hoy es Starter: no ocurre, pero si ocurriera el panel del mes es la casa.
  if (!g.ok) redirect(`/${slug}/dashboard`);
  const tenant = g.ctx;

  const canClases = hasFeature(tenant.plan, "clases");
  const hoy = hoyYMD();

  // Entrenador ve /hoy (tiene ver_pantalla_hoy) pero su rol es "sin caja ni
  // finanzas" (D6) — sin esto veía la cifra de Ingresos y un botón directo a
  // Caja, aunque no pudiera cobrar de verdad (bloque-04).
  const canCobrar = hasPermission(tenant.role, "registrar_pagos");
  const canOpiniones = hasFeature(tenant.plan, "opiniones");
  const [alertasTodas, checkins, ingresos, sesionesHoy, sinTelefono, opinionesSem] =
    await Promise.all([
      getAlertas(tenant.id, slug),
      getCheckinsStats(tenant.id),
      getIngresosStats(tenant.id),
      canClases
        ? getSesionesByRango(tenant.id, hoy, hoy)
        : Promise.resolve([] as ClaseSesion[]),
      countMiembrosSinTelefono(tenant.id),
      canOpiniones
        ? getPromedioSemana(tenant.id)
        : Promise.resolve({ promedio: 0, total: 0 }),
    ]);

  // Puntos de atención según el plan: stock (inventario, Pro), prospectos
  // (Pro) y socios en riesgo (riesgo_panel, Pro). Vencimientos: todos.
  const alertaVisible = (tipo: (typeof alertasTodas)[number]["tipo"]) =>
    tipo === "stock_bajo"
      ? hasFeature(tenant.plan, "inventario")
      : tipo === "prospecto_sin_contactar"
        ? hasFeature(tenant.plan, "prospectos")
        : tipo === "miembro_inactivo"
          ? hasFeature(tenant.plan, "riesgo_panel")
          : true;
  const alertas = alertasTodas.filter((a) => alertaVisible(a.tipo));
  const canRiesgo = hasFeature(tenant.plan, "riesgo_panel");

  const porTipo = (tipo: (typeof alertas)[number]["tipo"]) =>
    alertas.find((a) => a.tipo === tipo)?.count ?? 0;
  const vencenHoy = porTipo("vencimiento_hoy");
  const vencenProximo = porTipo("vencimiento_proximo");
  const sinVenir = porTipo("miembro_inactivo");

  // Avisos de datos: van como filas más de "Puntos de atención".
  const extras = (
    <>
      {sinTelefono > 0 && (
        <li className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="w-10 shrink-0 font-mono text-2xl font-bold tabular-nums text-warning">
              {sinTelefono}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] leading-5 text-text-primary">
                {sinTelefono === 1 ? "Miembro" : "Miembros"} sin teléfono
              </p>
              <p className="mt-0.5 text-sm text-text-muted">
                No les llegan avisos ni recordatorios
              </p>
            </div>
          </div>
          <Link
            href={`/${slug}/miembros?filter=sin_telefono`}
            className="shrink-0 text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
          >
            Ver lista
          </Link>
        </li>
      )}
      {opinionesSem.total > 0 && opinionesSem.promedio < 3 && (
        <li className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="w-10 shrink-0 font-mono text-2xl font-bold tabular-nums text-danger">
              {opinionesSem.promedio.toFixed(1)}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] leading-5 text-text-primary">
                Tu calificación bajó esta semana
              </p>
              <p className="mt-0.5 text-sm text-text-muted">
                Promedio de {opinionesSem.total}{" "}
                {opinionesSem.total === 1 ? "opinión" : "opiniones"}
              </p>
            </div>
          </div>
          <Link
            href={`/${slug}/opiniones`}
            className="shrink-0 text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
          >
            Ver opiniones
          </Link>
        </li>
      )}
    </>
  );
  const hayExtras =
    sinTelefono > 0 || (opinionesSem.total > 0 && opinionesSem.promedio < 3);
  const totalAtencion = alertas.length + (sinTelefono > 0 ? 1 : 0) +
    (opinionesSem.total > 0 && opinionesSem.promedio < 3 ? 1 : 0);

  return (
    <div className="flex flex-col gap-7">
      {/* Encabezado: fecha en mono, título en Geist, acciones del día */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            {formatFechaHoy()}
          </p>
          <h2 className="text-pagina font-semibold text-text-primary">Hoy</h2>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/checkins`}
            className="inline-flex h-11 items-center border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary"
          >
            Registrar entrada
          </Link>
          {canCobrar && (
            <Link
              href={`/${slug}/caja`}
              className="inline-flex h-11 items-center bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
            >
              Cobrar
            </Link>
          )}
        </div>
      </div>

      {/* Cifras del día */}
      <div className={`grid gap-4 sm:grid-cols-2 ${canRiesgo ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <StatCard index={0} label="Check-ins" value={checkins.hoy} />
        {canCobrar && (
          <StatCard
            index={1}
            label="Ingresos"
            value={ingresos.hoy}
            format="currency"
            variant={ingresos.hoy > 0 ? "success" : "default"}
          />
        )}
        <StatCard
          index={2}
          label="Vencen hoy"
          value={vencenHoy}
          variant={vencenHoy > 0 ? "warning" : "default"}
          hint={
            vencenProximo > 0
              ? `${vencenProximo} en los próximos 7 días`
              : undefined
          }
        />
        {canRiesgo && (
          <StatCard
            index={3}
            label="Sin venir 14 días"
            value={sinVenir}
            hint="con membresía vigente"
          />
        )}
      </div>

      {/* Puntos de atención + clases */}
      <div className="grid gap-4 xl:grid-cols-3">
        <section className={`card-surface ${canClases ? "xl:col-span-2" : "xl:col-span-3"}`}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold text-text-primary">
              Puntos de atención
            </h3>
            <span className="font-mono text-etiqueta text-text-muted">
              {totalAtencion}
            </span>
          </div>
          <AlertasList alertas={alertas} extra={hayExtras ? extras : undefined} />
        </section>

        {canClases && (
          <section className="card-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-text-primary">
                Clases de hoy
              </h3>
              <Link
                href={`/${slug}/clases`}
                className="text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
              >
                Calendario
              </Link>
            </div>
            <ClasesHoy sesiones={sesionesHoy} slug={slug} />
          </section>
        )}
      </div>
    </div>
  );
}
