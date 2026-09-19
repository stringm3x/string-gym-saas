import type { ReactNode } from "react";

interface AuthShellProps {
  /** Contenido de la tarjeta (formulario). */
  children: ReactNode;
  /** Titular Anton del lado izquierdo. Máximo tres líneas. */
  headline?: ReactNode;
  /** Bajada bajo el titular. */
  lead?: string;
  /** Kicker mono junto al monograma. */
  marca?: string;
}

/**
 * Marco de las pantallas de acceso (artboard "Acceso — escritorio"): aquí
 * sí entra el cartel. Izquierda: monograma, titular Anton y bajada.
 * Derecha: tarjeta con sombra dura en ácido. En móvil se apila y el titular
 * baja de tamaño; la tarjeta siempre queda a la vista sin scroll extra.
 */
export function AuthShell({
  children,
  headline = (
    <>
      TU GIMNASIO,
      <br />
      EN{" "}
      <span className="bg-brand-green px-2.5 text-on-brand">ORDEN</span>.
    </>
  ),
  lead = "Socios, caja, check-in, clases e inventario en un solo lugar. Abre el panel y en cinco segundos sabes cómo va tu día.",
  marca = "STRING GYM",
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      {/* Cartel */}
      <section className="flex flex-col justify-between px-6 pb-10 pt-8 sm:px-10 lg:w-[55%] lg:px-16 lg:py-16">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center bg-brand-green font-display text-[26px] leading-none text-on-brand"
          >
            S
          </span>
          <span className="font-mono text-etiqueta uppercase text-text-secondary">
            {marca}
          </span>
        </div>

        <div className="my-10 flex flex-col gap-6 lg:my-0 lg:gap-10">
          <h1 className="font-display text-titular-l uppercase text-text-primary sm:text-[72px] sm:leading-[66px] xl:text-titular-xl">
            {headline}
          </h1>
          <p className="max-w-[560px] text-cuerpo text-text-secondary lg:text-cuerpo-l">
            {lead}
          </p>
        </div>

        <div className="hidden items-center gap-6 border-t border-border pt-6 lg:flex">
          <span className="font-mono text-etiqueta uppercase text-text-muted">
            app.gym.stringwebs.com
          </span>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <span className="font-mono text-etiqueta uppercase text-text-muted">
            Ciudad de México
          </span>
        </div>
      </section>

      {/* Tarjeta */}
      <section className="flex flex-1 items-start justify-center px-6 pb-16 sm:px-10 lg:items-center lg:border-l lg:border-border lg:px-12 lg:py-12">
        <div className="w-full max-w-[448px] border border-border bg-surface p-8 shadow-hard-green sm:p-10">
          {children}
        </div>
      </section>
    </div>
  );
}

/** Encabezado de la tarjeta: kicker mono + título Geist + una línea. */
export function AuthCardHeader({
  kicker,
  titulo,
  texto,
}: {
  kicker: string;
  titulo: string;
  texto?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      <p className="font-mono text-etiqueta uppercase text-brand-green">
        {kicker}
      </p>
      <h2 className="text-pagina font-semibold text-text-primary">{titulo}</h2>
      {texto && <p className="text-cuerpo-s text-text-secondary">{texto}</p>}
    </div>
  );
}
