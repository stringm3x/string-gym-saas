import { cerrarSesionPortalAction } from "@/app/portal/[slug]/actions";

/** Barra superior del portal: nombre del gym + cerrar sesión. */
export function PortalHeader({
  slug,
  gymNombre,
}: {
  slug: string;
  gymNombre: string;
}) {
  const cerrar = cerrarSesionPortalAction.bind(null, slug);
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <span className="font-display text-lg uppercase tracking-wide text-text-primary">
        {gymNombre}
      </span>
      <form action={cerrar}>
        <button
          type="submit"
          className="text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          Cerrar sesión
        </button>
      </form>
    </header>
  );
}
