import Link from "next/link";
import {
  LuCircleCheck,
  LuCircleDashed,
  LuDownload,
  LuArrowRight,
} from "react-icons/lu";
import { LuExternalLink, LuQrCode } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import {
  getOnboardingEstado,
  getDemoMiembro,
} from "@/lib/queries/onboarding.queries";
import { completarOnboardingAction } from "./actions";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
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

export default async function OnboardingPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { error } = await searchParams;
  const tenant = await getTenant();
  const [estado, demo] = await Promise.all([
    getOnboardingEstado(tenant.id),
    getDemoMiembro(tenant.id),
  ]);

  // El inventario solo aplica a planes con la feature (Pro/Escala).
  const requiereProducto = hasFeature(tenant.plan, "inventario");
  const puedeCompletar =
    estado.tienePlanes &&
    estado.tieneMiembros &&
    (!requiereProducto || estado.tieneProductos);

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

      {/* Demo del Portal del Miembro (Fase P.2) */}
      {demo && (
        <section className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-5">
          <h2 className="text-base font-semibold text-text-primary">
            🎯 Prueba el Portal del Miembro
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Creamos un miembro de demo para que veas cómo lo ven tus clientes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/portal/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnPrimary}
            >
              Ver Portal del Demo <LuExternalLink className="h-4 w-4" />
            </a>
            {demo.qr_token && (
              <a href={`/qr/${demo.qr_token}`} className={btnGhost}>
                <LuQrCode className="h-4 w-4" /> Ver QR del Demo
              </a>
            )}
          </div>
        </section>
      )}

      {error === "incompleto" && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Completa los pasos antes de finalizar: crea un plan, registra al menos
          un miembro
          {requiereProducto ? " y carga un producto." : "."}
        </p>
      )}

      <form action={completarOnboardingAction} className="pt-2">
        <button
          type="submit"
          disabled={!puedeCompletar}
          className="w-full rounded-lg border border-border px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-text-primary"
        >
          Marcar como completado
        </button>
        {!puedeCompletar && (
          <p className="mt-2 text-center text-xs text-text-muted">
            Termina{" "}
            {requiereProducto
              ? "los 3 pasos (planes, miembros e inventario)"
              : "los pasos (planes y miembros)"}{" "}
            para finalizar.
          </p>
        )}
      </form>
    </div>
  );
}
