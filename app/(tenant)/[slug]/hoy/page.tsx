import { redirect } from "next/navigation";
import { LuScanLine, LuWallet, LuCalendarX } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { getAlertas } from "@/lib/queries/alertas.queries";
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
  const s = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function HoyPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  // Hoy es panel estratégico del dueño — el recepcionista va a check-ins.
  if (!hasPermission(tenant.role, "ver_pantalla_hoy")) {
    redirect(`/${slug}/checkins`);
  }

  if (!hasFeature(tenant.plan, "pantalla_hoy")) {
    redirect(`/${slug}/dashboard`);
  }

  const canClases = hasFeature(tenant.plan, "clases");
  const hoy = hoyYMD();

  const [alertas, checkins, ingresos, sesionesHoy] = await Promise.all([
    getAlertas(tenant.id, slug),
    getCheckinsStats(tenant.id),
    getIngresosStats(tenant.id),
    canClases
      ? getSesionesByRango(tenant.id, hoy, hoy)
      : Promise.resolve([] as ClaseSesion[]),
  ]);

  const vencenHoy =
    alertas.find((a) => a.tipo === "vencimiento_hoy")?.count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Hoy
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{formatFechaHoy()}</p>
      </div>

      {/* Stats del día */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Check-ins hoy"
          value={checkins.hoy}
          variant="default"
          icon={<LuScanLine className="h-4 w-4" />}
        />
        <StatCard
          label="Ingresos hoy"
          value={ingresos.hoy}
          format="currency"
          variant={ingresos.hoy > 0 ? "success" : "default"}
          icon={<LuWallet className="h-4 w-4" />}
        />
        <StatCard
          label="Vencimientos hoy"
          value={vencenHoy}
          variant={vencenHoy > 0 ? "warning" : "default"}
          icon={<LuCalendarX className="h-4 w-4" />}
        />
      </div>

      {/* Clases de hoy */}
      {canClases && (
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Clases de hoy
          </h3>
          <ClasesHoy sesiones={sesionesHoy} slug={slug} />
        </div>
      )}

      {/* Alertas */}
      <div>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Puntos de atención
        </h3>
        <AlertasList alertas={alertas} />
      </div>
    </div>
  );
}
