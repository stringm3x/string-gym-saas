import {
  LuUsers,
  LuCircleCheck,
  LuTriangleAlert,
  LuWallet,
  LuScanLine,
  LuCalendarDays,
  LuTrendingUp,
  LuUserPlus,
} from "react-icons/lu";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import {
  getMiembrosStats,
  getIngresosStats,
  getCheckinsStats,
  listMiembrosPorVencer,
} from "@/lib/queries/dashboard.queries";
import { countVisitasRapidasHoy } from "@/lib/queries/pagos.queries";
import {
  getIngresosPorSemana,
  getCheckinsPorDiaSemana,
  getRetencion,
  getMembresiasBreakdown,
  getDashboardSparklines,
} from "@/lib/queries/dashboard-charts.queries";
import { getMetricasNegocio } from "@/lib/queries/negocio.queries";
import { StatCard } from "@/components/dashboard/StatCard";
import { SaludNegocio } from "@/components/dashboard/SaludNegocio";
import { CheckinsChart } from "@/components/dashboard/CheckinsChart";
import { PorVencerList } from "@/components/dashboard/PorVencerList";
import { IngresosSemanaChart } from "@/components/dashboard/IngresosSemanaChart";
import { CheckinsSemanaChart } from "@/components/dashboard/CheckinsSemanaChart";
import { RetencionCard } from "@/components/dashboard/RetencionCard";
import { MembresiasDonut } from "@/components/dashboard/MembresiasDonut";

// Verde STRING fijo: el panel del staff ya no se personaliza (plan/02-gating).
const COLOR_ACENTO_DEFAULT = "var(--color-brand-green)";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DashboardPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (!hasPermission(tenant.role, "ver_dashboard_completo")) {
    redirect(`/${slug}/checkins`);
  }

  const [
    miembros,
    ingresos,
    checkins,
    porVencer,
    visitasHoy,
    ingresosSemana,
    checkinsDia,
    retencion,
    membresias,
    sparklines,
    metricas,
  ] = await Promise.all([
    getMiembrosStats(tenant.id),
    getIngresosStats(tenant.id),
    getCheckinsStats(tenant.id),
    listMiembrosPorVencer(tenant.id, 7),
    countVisitasRapidasHoy(tenant.id),
    getIngresosPorSemana(tenant.id),
    getCheckinsPorDiaSemana(tenant.id),
    getRetencion(tenant.id),
    getMembresiasBreakdown(tenant.id),
    getDashboardSparklines(tenant.id),
    getMetricasNegocio(tenant.id),
  ]);

  // Panel completo (MRR, ARPU, LTV, rotación) es Pro; el panel del mes
  // básico (cifras y gráficas) está en todos los planes.
  const canNegocio =
    hasPermission(tenant.role, "ver_dashboard_ingresos") &&
    hasFeature(tenant.plan, "dashboard_completo");

  // El panel del staff ya no se personaliza (plan/02-gating): el color del
  // gym solo se respeta hacia el socio (portal, kiosco, QR, recibo).
  const colorAcento = COLOR_ACENTO_DEFAULT;

  // Calcular delta del mes vs mes anterior
  const deltaMes = (() => {
    if (ingresos.mesAnterior === 0) {
      return ingresos.mes > 0
        ? { value: 100, direction: "up" as const }
        : { value: 0, direction: "flat" as const };
    }
    const pct =
      ((ingresos.mes - ingresos.mesAnterior) / ingresos.mesAnterior) * 100;
    if (Math.abs(pct) < 1) return { value: 0, direction: "flat" as const };
    return {
      value: pct,
      direction: pct > 0 ? ("up" as const) : ("down" as const),
    };
  })();

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          Panel del mes
        </p>
        <h2 className="mt-1.5 text-pagina font-semibold text-text-primary">
          Panel
        </h2>
      </div>

      {canNegocio && <SaludNegocio metricas={metricas} slug={slug} />}

      {/* Métricas de miembros */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          index={0}
          label="Miembros activos"
          value={miembros.activos}
          variant="success"
          icon={<LuCircleCheck className="h-4 w-4" />}
          hint={`de ${miembros.total} totales`}
        />
        <StatCard
          index={1}
          label="Por vencer (7 días)"
          value={miembros.por_vencer}
          variant="warning"
          icon={<LuTriangleAlert className="h-4 w-4" />}
        />
        <StatCard
          index={2}
          label="Inactivos"
          value={miembros.inactivos}
          variant="default"
          icon={<LuUsers className="h-4 w-4" />}
        />
        <StatCard
          index={3}
          label="Check-ins hoy"
          value={checkins.hoy}
          variant="default"
          icon={<LuScanLine className="h-4 w-4" />}
          sparkline={checkins.ultimos7Dias.map((d) => d.cantidad)}
          sparklineColor={colorAcento}
        />
        <StatCard
          index={4}
          label="Visitas hoy"
          value={visitasHoy}
          variant="default"
          icon={<LuUserPlus className="h-4 w-4" />}
          sparkline={sparklines.visitasDiarias}
          sparklineColor={colorAcento}
        />
      </div>

      {/* Métricas de ingresos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          index={5}
          label="Ingresos hoy"
          value={ingresos.hoy}
          format="currency"
          variant="success"
          icon={<LuWallet className="h-4 w-4" />}
          sparkline={sparklines.ingresosDiarios}
          sparklineColor={colorAcento}
        />
        <StatCard
          index={6}
          label="Esta semana"
          value={ingresos.semana}
          format="currency"
          variant="default"
          icon={<LuCalendarDays className="h-4 w-4" />}
          sparkline={ingresosSemana.map((s) => s.monto)}
          sparklineColor={colorAcento}
        />
        <StatCard
          index={7}
          label="Este mes"
          value={ingresos.mes}
          format="currency"
          variant="default"
          icon={<LuTrendingUp className="h-4 w-4" />}
          delta={deltaMes}
          hint="vs mes anterior"
          sparkline={sparklines.ingresosMensuales}
          sparklineColor={colorAcento}
        />
      </div>

      {/* Gráfica de check-ins y lista de por vencer */}
      <div
        className="animate-stat-in grid gap-6 lg:grid-cols-2"
        style={{ animationDelay: "560ms" }}
      >
        <CheckinsChart data={checkins.ultimos7Dias} />
        <PorVencerList miembros={porVencer} slug={slug} />
      </div>

      {/* Gráficas (Fase I.1) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <IngresosSemanaChart data={ingresosSemana} color={colorAcento} />
        <CheckinsSemanaChart data={checkinsDia} color={colorAcento} />
        <RetencionCard data={retencion} />
        <MembresiasDonut data={membresias} slug={slug} />
      </div>
    </div>
  );
}
