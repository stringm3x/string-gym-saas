import Link from "next/link";
import {
  LuDownload,
  LuArrowRight,
  LuExternalLink,
  LuQrCode,
} from "react-icons/lu";
import { requirePanel } from "@/lib/authz/pagina";
import { hasFeature } from "@/lib/features";
import {
  getOnboardingEstado,
  getDemoMiembro,
} from "@/lib/queries/onboarding.queries";
import { Badge } from "@/components/ui/Badge";
import { TitularBrochada } from "@/components/arte/Brochada";
import { Sello } from "@/components/arte/Sello";
import { completarOnboardingAction, saltarOnboardingAction } from "./actions";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}

const btnPrimary =
  "inline-flex h-11 items-center gap-2 bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90";
const btnSecondary =
  "inline-flex h-11 items-center gap-2 border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary";

function Paso({
  numero,
  titulo,
  texto,
  hecho,
  opcional,
  children,
}: {
  numero: string;
  titulo: string;
  texto: string;
  hecho: boolean;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            Paso {numero}
            {opcional && " (opcional)"}
          </p>
          <h2 className="text-lg font-semibold text-text-primary">{titulo}</h2>
          <p className="text-cuerpo-s text-text-secondary">{texto}</p>
        </div>
        <Badge variant={hecho ? "success" : "neutral"}>
          {hecho ? "Hecho" : opcional ? "Opcional" : "Pendiente"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

/**
 * Guía de primer acceso. El dueño está conociendo el producto: entra el
 * cartel en el titular, y nada más. Los pasos son tarjetas densas.
 */
export default async function OnboardingPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { error } = await searchParams;
  // Misma política que completarOnboardingAction (configurar_general): la
  // guía es del dueño y el gerente; antes recepción la veía con un botón inútil.
  const g = await requirePanel("onboarding.completar", { sinPermiso: "/checkins" });
  if (!g.ok) return null; // miembros es Starter: no ocurre
  const tenant = g.ctx;
  const [estado, demo] = await Promise.all([
    getOnboardingEstado(tenant.id),
    getDemoMiembro(tenant.id),
  ]);

  // El inventario solo aplica a planes con la feature (Pro/Escala), y es
  // siempre opcional: un gym que no vende productos no debe quedar
  // atrapado en la guía por eso (Bloque 10 PR2).
  const requiereProducto = hasFeature(tenant.plan, "inventario");
  const puedeCompletar = estado.tienePlanes && estado.tieneMiembros;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4">
      <div className="relative flex flex-col gap-3">
        <Sello className="absolute -top-2 right-0 hidden sm:block" />
        <p className="font-mono text-etiqueta uppercase text-brand-green">
          Guía de inicio
        </p>
        <TitularBrochada
          lineas={["BIENVENIDO A", "STRING GYM"]}
          forma="tachon"
          className="font-display text-titular-l uppercase text-text-primary"
        />
        <p className="max-w-lg text-cuerpo text-text-secondary">
          Dos pasos dejan tu gimnasio listo para operar
          {requiereProducto && " (el inventario es opcional)"}. Puedes volver
          a esta guía cuando quieras desde Configuración.
        </p>
      </div>

      <Paso
        numero="01"
        titulo="Crea tus planes de membresía"
        texto="Antes de importar socios, el sistema necesita conocer tus planes (Mensual $350, Trimestral $800, etc.)."
        hecho={estado.tienePlanes}
      >
        <Link href={`/${slug}/configuracion/planes`} className={btnPrimary}>
          Ir a Planes <LuArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Paso>

      <Paso
        numero="02"
        titulo="Importa tus socios"
        texto="Descarga la plantilla CSV, llena los datos de tus socios y súbela. Si llevas un Excel, guárdalo como CSV."
        hecho={estado.tieneMiembros}
      >
        <a
          href={`/api/${slug}/plantilla-miembros`}
          className={btnSecondary}
          download
        >
          <LuDownload className="h-4 w-4" aria-hidden="true" /> Descargar
          plantilla CSV
        </a>
        <Link href={`/${slug}/miembros/importar`} className={btnPrimary}>
          Importar socios <LuArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Paso>

      {requiereProducto && (
        <Paso
          numero="03"
          titulo="Carga tu inventario"
          texto="Agrega los productos que vendes en el gimnasio (suplementos, bebidas, snacks). Sáltalo si no vendes productos."
          hecho={estado.tieneProductos}
          opcional
        >
          <Link href={`/${slug}/inventario`} className={btnPrimary}>
            Ir a Inventario <LuArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Paso>
      )}

      {/* Demo del Portal del Miembro (Fase P.2) */}
      {demo && (
        <section className="flex flex-col gap-5 border border-brand-green/40 bg-brand-green/5 p-6">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-etiqueta uppercase text-brand-green">
              Pruébalo como socio
            </p>
            <h2 className="text-lg font-semibold text-text-primary">
              Mira el portal como lo ven tus socios
            </h2>
            <p className="text-cuerpo-s text-text-secondary">
              Creamos un socio de demostración con su QR para que lo pruebes.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/portal/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnPrimary}
            >
              Abrir el portal{" "}
              <LuExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            {demo.qr_token && (
              <a href={`/qr/${demo.qr_token}`} className={btnSecondary}>
                <LuQrCode className="h-4 w-4" aria-hidden="true" /> Ver el QR
              </a>
            )}
          </div>
        </section>
      )}

      {error === "incompleto" && (
        <p
          role="alert"
          className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          Completa los pasos antes de finalizar: crea un plan y registra al
          menos un socio.
        </p>
      )}

      <form action={completarOnboardingAction} className="flex flex-col gap-2 pt-2">
        <button
          type="submit"
          disabled={!puedeCompletar}
          className="inline-flex h-12 w-full items-center justify-center border border-border px-4 text-base text-text-primary transition-colors hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-text-primary"
        >
          Marcar como completado
        </button>
        {!puedeCompletar && (
          <p className="text-center font-mono text-etiqueta uppercase text-text-muted">
            Termina los 2 pasos para finalizar
          </p>
        )}
      </form>

      <form action={saltarOnboardingAction} className="pb-2 text-center">
        <button
          type="submit"
          className="font-mono text-etiqueta uppercase text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline"
        >
          Saltar por ahora
        </button>
      </form>
    </div>
  );
}
