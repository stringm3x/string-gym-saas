import Link from "next/link";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import {
  getCxCResumen,
  getCuotasPendientes,
} from "@/lib/queries/creditos.queries";
import { CxCList } from "@/components/creditos/CxCList";
import { money } from "@/lib/utils/creditos-calc";
import { LuDollarSign, LuZap } from "react-icons/lu";

type Filtro = "todas" | "vencidas" | "por_vencer";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "vencidas", label: "Vencidas" },
  { key: "por_vencer", label: "Por vencer (7 días)" },
];

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filtro?: string }>;
}

export default async function CuentasPorCobrarPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "creditos")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Cuentas por cobrar"
        descripcion="Cobra membresías a plazos y da seguimiento a las cuotas por cobrar de todos tus miembros en un solo lugar."
        beneficios={[
          "Planes de pago a plazos (2 a 12 cuotas)",
          "Membresía activa desde el primer pago",
          "Alertas de cuotas vencidas y por vencer",
          "Cobro de cuotas con un clic",
        ]}
        planRequerido="escala"
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const { filtro: filtroRaw } = await searchParams;
  const filtro: Filtro =
    filtroRaw === "vencidas" || filtroRaw === "por_vencer"
      ? filtroRaw
      : "todas";

  const [resumen, cuotas] = await Promise.all([
    getCxCResumen(tenant.id),
    getCuotasPendientes(tenant.id),
  ]);

  const filtradas = cuotas.filter((c) => {
    if (filtro === "vencidas") return c.estado_calc === "vencida";
    if (filtro === "por_vencer")
      return c.estado_calc !== "vencida" && c.dias_para_vencer <= 7;
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Cuentas por cobrar
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Cuotas pendientes de tus planes de pago a plazos.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-1 text-xs text-text-secondary">
            <LuDollarSign className="h-3.5 w-3.5" /> Total pendiente
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {money(resumen.total_pendiente)}
          </p>
        </div>
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-xs text-danger">Vencido</p>
          <p className="mt-1 text-2xl font-semibold text-danger">
            {money(resumen.vencidas_monto)}
          </p>
          <p className="text-xs text-text-secondary">
            {resumen.vencidas_count} cuota
            {resumen.vencidas_count === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="flex items-center gap-1 text-xs text-warning">
            <LuZap className="h-3.5 w-3.5" /> Por vencer (7 días)
          </p>
          <p className="mt-1 text-2xl font-semibold text-warning">
            {money(resumen.por_vencer_monto)}
          </p>
          <p className="text-xs text-text-secondary">
            {resumen.por_vencer_count} cuota
            {resumen.por_vencer_count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {FILTROS.map((f) => {
          const active = filtro === f.key;
          return (
            <Link
              key={f.key}
              href={
                f.key === "todas"
                  ? `/${slug}/cuentas-por-cobrar`
                  : `/${slug}/cuentas-por-cobrar?filtro=${f.key}`
              }
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {f.label}
              {active && (
                <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-brand-green" />
              )}
            </Link>
          );
        })}
      </div>

      <CxCList cuotas={filtradas} />
    </div>
  );
}
