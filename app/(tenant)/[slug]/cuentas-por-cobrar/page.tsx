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
import { cn } from "@/lib/utils/cn";

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

/**
 * Cuentas por cobrar: tres cifras en mono (pendiente, vencido, por vencer),
 * filtros como chips con el estado seleccionado, lista de cuotas.
 */
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
        planRequerido="pro"
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
    <div className="mx-auto flex max-w-4xl flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          {cuotas.length} {cuotas.length === 1 ? "cuota pendiente" : "cuotas pendientes"}
        </p>
        <h2 className="text-pagina font-semibold text-text-primary">
          Cuentas por cobrar
        </h2>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Cifra label="Total pendiente" valor={money(resumen.total_pendiente)} />
        <Cifra
          label="Vencido"
          valor={money(resumen.vencidas_monto)}
          hint={`${resumen.vencidas_count} ${resumen.vencidas_count === 1 ? "cuota" : "cuotas"}`}
          tono={resumen.vencidas_count > 0 ? "danger" : "default"}
        />
        <Cifra
          label="Por vencer (7 días)"
          valor={money(resumen.por_vencer_monto)}
          hint={`${resumen.por_vencer_count} ${resumen.por_vencer_count === 1 ? "cuota" : "cuotas"}`}
          tono={resumen.por_vencer_count > 0 ? "warning" : "default"}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
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
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center border px-4 text-sm transition-colors",
                active
                  ? "border-brand-green bg-surface-hover text-brand-green"
                  : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <CxCList cuotas={filtradas} />
    </div>
  );
}

function Cifra({
  label,
  valor,
  hint,
  tono = "default",
}: {
  label: string;
  valor: string;
  hint?: string;
  tono?: "default" | "danger" | "warning";
}) {
  const color =
    tono === "danger"
      ? "text-danger"
      : tono === "warning"
        ? "text-warning"
        : "text-text-primary";
  return (
    <div className="card-surface flex flex-col gap-2.5 p-5">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        {label}
      </p>
      <p className={cn("font-mono text-cifra font-bold tabular-nums", color)}>
        {valor}
      </p>
      {hint && <p className="text-sm text-text-muted">{hint}</p>}
    </div>
  );
}
