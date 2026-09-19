import Link from "next/link";
import { LuArrowLeft, LuCheck } from "react-icons/lu";
import { PLAN_LABELS, type Plan } from "@/lib/features";
import { STRING_SOPORTE_WHATSAPP } from "@/lib/constants";

interface UpgradePageProps {
  /** Título de la sección bloqueada (ej. "Inventario"). */
  titulo: string;
  /** Descripción de lo que ofrece la sección. */
  descripcion: string;
  /** Beneficios que se desbloquean con el upgrade. */
  beneficios: string[];
  /** Plan requerido para acceder. */
  planRequerido: Exclude<Plan, "basico">;
  /** Nombre del gym, para el mensaje de WhatsApp. */
  gymNombre: string;
  /** Slug del tenant, para el botón "Volver". */
  slug: string;
}

/**
 * Sección fuera del plan. Aquí el gimnasio está conociendo el producto, no
 * trabajando: entra el cartel (Anton) con moderación. Un solo titular.
 */
export function UpgradePage({
  titulo,
  descripcion,
  beneficios,
  planRequerido,
  gymNombre,
  slug,
}: UpgradePageProps) {
  const planLabel = PLAN_LABELS[planRequerido];
  const mensaje = `Hola, soy del gym ${gymNombre} y quiero mejorar a Plan ${planLabel}`;
  const whatsappUrl = `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(
    mensaje
  )}`;

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="flex flex-col gap-8 border border-border bg-surface p-8 sm:p-10">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-etiqueta uppercase text-brand-green">
            Plan {planLabel}
          </p>
          <h2 className="font-display text-titular-m uppercase text-text-primary">
            {titulo}
          </h2>
          <p className="text-cuerpo-s text-text-secondary">{descripcion}</p>
        </div>

        {beneficios.length > 0 && (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {beneficios.map((b) => (
              <li
                key={b}
                className="flex items-center gap-3 py-3 text-sm text-text-primary"
              >
                <LuCheck
                  className="h-4 w-4 shrink-0 text-brand-green"
                  aria-hidden="true"
                />
                {b}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center bg-brand-green px-6 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
          >
            Mejorar a Plan {planLabel}
          </a>
          <Link
            href={`/${slug}/dashboard`}
            className="inline-flex h-11 items-center justify-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al panel
          </Link>
        </div>
      </div>
    </div>
  );
}
