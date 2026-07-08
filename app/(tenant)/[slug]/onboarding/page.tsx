import Link from "next/link";
import {
  LuCircleCheck,
  LuCircleDashed,
  LuDownload,
  LuArrowRight,
} from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { getOnboardingEstado } from "@/lib/queries/onboarding.queries";
import { completarOnboardingAction } from "./actions";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function EstadoBadge({ hecho }: { hecho: boolean }) {
  return hecho ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-xs font-medium text-brand-green">
      <LuCircleCheck className="h-3.5 w-3.5" /> Hecho
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
      <LuCircleDashed className="h-3.5 w-3.5" /> Pendiente
    </span>
  );
}

export default async function OnboardingPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();
  const estado = await getOnboardingEstado(tenant.id);

  const btnPrimary =
    "inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90";
  const btnGhost =
    "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition-colors hover:border-brand-green";

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Bienvenido a STRING GYM
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Estos 3 pasos dejan tu gimnasio listo para operar. Puedes volver a
          esta guía cuando quieras desde Configuración.
        </p>
      </div>

      {/* Paso 1 — Planes */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-text-muted">
              Paso 1
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-text-primary">
              Crea tus planes de membresía
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Antes de importar miembros, el sistema necesita conocer tus planes
              (Mensual $350, Trimestral $800, etc.).
            </p>
          </div>
          <EstadoBadge hecho={estado.tienePlanes} />
        </div>
        <div className="mt-4">
          <Link href={`/${slug}/configuracion/planes`} className={btnPrimary}>
            Ir a Planes <LuArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Paso 2 — Miembros */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-text-muted">
              Paso 2
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-text-primary">
              Importa tus miembros
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Descarga la plantilla, llena los datos de tus miembros y súbela al
              sistema.
            </p>
          </div>
          <EstadoBadge hecho={estado.tieneMiembros} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`/api/${slug}/plantilla-miembros`}
            className={btnGhost}
            download
          >
            <LuDownload className="h-4 w-4" /> Descargar plantilla CSV
          </a>
          <Link href={`/${slug}/miembros/importar`} className={btnPrimary}>
            Importar miembros <LuArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Paso 3 — Inventario */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-text-muted">
              Paso 3
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-text-primary">
              Carga tu inventario
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Agrega los productos que vendes en tu gym (suplementos, bebidas,
              snacks).
            </p>
          </div>
          <EstadoBadge hecho={estado.tieneProductos} />
        </div>
        <div className="mt-4">
          <Link href={`/${slug}/inventario`} className={btnPrimary}>
            Ir a Inventario <LuArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <form action={completarOnboardingAction} className="pt-2">
        <button
          type="submit"
          className="w-full rounded-lg border border-border px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-brand-green hover:text-brand-green"
        >
          Marcar como completado
        </button>
      </form>
    </div>
  );
}
