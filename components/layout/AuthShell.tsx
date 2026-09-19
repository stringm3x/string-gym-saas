import type { ReactNode } from "react";
import { TitularBrochada, type BrochadaForma } from "@/components/arte/Brochada";
import { Cinta } from "@/components/arte/Cinta";
import { Sello } from "@/components/arte/Sello";
import { Grano } from "@/components/arte/Grano";
import { MarcasRegistro } from "@/components/arte/MarcasRegistro";

interface AuthShellProps {
  /** Contenido de la tarjeta (formulario). */
  children: ReactNode;
  /** Líneas del titular Anton. Máximo tres. */
  lineas?: string[];
  /** Forma de la brochada que cruza el titular. */
  forma?: BrochadaForma;
  /** Bajada bajo el titular. */
  lead?: string;
  /** Kicker mono junto al monograma. */
  marca?: string;
  /** Texto de la cinta al pie del cartel. */
  cinta?: string;
}

/**
 * Marco de las pantallas de acceso (artboard "Acceso — escritorio"): aquí
 * sí entra el cartel, con las mismas piezas que stringwebs.com: titular
 * cruzado por una brochada, grano de impresión, sello girando y cinta al
 * pie. Derecha: tarjeta con sombra dura en ácido y marcas de registro. En
 * móvil se apila y el titular baja de tamaño.
 */
export function AuthShell({
  children,
  lineas = ["TU GIMNASIO,", "EN ORDEN."],
  forma = "diagonal",
  lead = "Socios, caja, check-in, clases e inventario en un solo lugar. Abre el panel y en cinco segundos sabes cómo va tu día.",
  marca = "STRING GYM",
  cinta = "STRING GYM · CDMX",
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg lg:flex-row">
      <Grano opacidad={0.2} />

      {/* Cartel */}
      <section className="relative flex flex-col justify-between overflow-hidden px-6 pb-0 pt-8 sm:px-10 lg:w-[55%] lg:px-16 lg:pt-16">
        <Sello className="absolute right-6 top-6 hidden lg:block" />

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
          <TitularBrochada
            lineas={lineas}
            forma={forma}
            className="font-display text-titular-l uppercase text-text-primary sm:text-[72px] sm:leading-[66px] xl:text-titular-xl"
          />
          <p className="max-w-[560px] text-cuerpo text-text-secondary lg:text-cuerpo-l">
            {lead}
          </p>
        </div>

        <div className="-mx-6 mt-10 sm:-mx-10 lg:-mx-16 lg:mt-0">
          <div className="hidden items-center gap-6 px-6 pb-6 sm:px-10 lg:flex lg:px-16">
            <span className="font-mono text-etiqueta uppercase text-text-muted">
              app.gym.stringwebs.com
            </span>
            <span aria-hidden="true" className="h-4 w-px bg-border" />
            <span className="font-mono text-etiqueta uppercase text-text-muted">
              Ciudad de México
            </span>
          </div>
          <Cinta texto={cinta} variante="inversa" />
        </div>
      </section>

      {/* Tarjeta */}
      <section className="flex flex-1 items-start justify-center px-6 py-12 sm:px-10 lg:items-center lg:border-l lg:border-border lg:px-12">
        <div className="relative w-full max-w-[448px] border border-border bg-surface p-8 shadow-hard-green sm:p-10">
          <MarcasRegistro className="text-text-muted/60" />
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
