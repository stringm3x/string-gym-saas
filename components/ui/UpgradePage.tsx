import Link from "next/link";
import { LuLock, LuArrowLeft, LuCheck } from "react-icons/lu";
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
    <div className="mx-auto max-w-lg py-12">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-surface px-8 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
          <LuLock className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <span className="inline-block rounded-full bg-brand-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-green">
            Plan {planLabel}
          </span>
          <h2 className="font-display text-2xl uppercase tracking-wide text-text-primary">
            {titulo}
          </h2>
          <p className="text-sm text-text-secondary">{descripcion}</p>
        </div>

        {beneficios.length > 0 && (
          <ul className="w-full space-y-2 text-left">
            {beneficios.map((b) => (
              <li
                key={b}
                className="flex items-center gap-2.5 text-sm text-text-secondary"
              >
                <LuCheck className="h-4 w-4 shrink-0 text-brand-green" />
                {b}
              </li>
            ))}
          </ul>
        )}

        <div className="flex w-full flex-col gap-2 pt-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-colors duration-150 hover:bg-brand-green/90"
          >
            Mejorar a Plan {planLabel}
          </a>
          <Link
            href={`/${slug}/dashboard`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <LuArrowLeft className="h-3.5 w-3.5" />
            Volver al dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
