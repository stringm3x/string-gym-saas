import Link from "next/link";
import { LuLock, LuArrowLeft } from "react-icons/lu";

interface AccessDeniedProps {
  slug: string;
  titulo?: string;
  mensaje?: string;
}

/**
 * Pantalla para recepcionistas que intentan acceder por URL directa a
 * una sección bloqueada por su rol.
 */
export function AccessDenied({
  slug,
  titulo = "Sin permiso para esta sección",
  mensaje = "Esta función está disponible solo para el dueño del gimnasio. Si necesitas acceso, contacta al dueño.",
}: AccessDeniedProps) {
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface px-8 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover text-text-muted">
          <LuLock className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl uppercase tracking-wide text-text-primary">
            {titulo}
          </h2>
          <p className="text-sm text-text-secondary">{mensaje}</p>
        </div>
        <Link
          href={`/${slug}/checkins`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-green/90"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          Volver a check-ins
        </Link>
      </div>
    </div>
  );
}
