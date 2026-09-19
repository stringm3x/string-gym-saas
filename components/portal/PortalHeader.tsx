import { cerrarSesionPortalAction } from "@/app/portal/[slug]/actions";

/**
 * Barra superior del portal (artboard "Portal del socio — móvil"): inicial
 * del gimnasio en su color + nombre, y salir. El color viene del layout.
 */
export function PortalHeader({
  slug,
  gymNombre,
}: {
  slug: string;
  gymNombre: string;
}) {
  const cerrar = cerrarSesionPortalAction.bind(null, slug);
  const inicial = (gymNombre.trim()[0] ?? "G").toUpperCase();
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-green font-display text-xl leading-none text-on-brand"
        >
          {inicial}
        </span>
        <span className="truncate text-base font-semibold text-text-primary">
          {gymNombre}
        </span>
      </div>
      <form action={cerrar}>
        <button
          type="submit"
          className="h-10 px-3 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Cerrar sesión
        </button>
      </form>
    </header>
  );
}
