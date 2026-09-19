import Link from "next/link";
import { LuLock, LuArrowLeft } from "react-icons/lu";
import { EmptyState } from "./EmptyState";

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
  titulo = "Solo para el dueño",
  mensaje = "Esta sección está disponible solo para el dueño del gimnasio. Si necesitas acceso, pídeselo.",
}: AccessDeniedProps) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon={<LuLock />}
        title={titulo}
        description={mensaje}
        action={
          <Link
            href={`/${slug}/checkins`}
            className="inline-flex h-11 items-center gap-2 bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
          >
            <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a check-in
          </Link>
        }
      />
    </div>
  );
}
