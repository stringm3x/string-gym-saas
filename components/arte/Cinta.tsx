const REPETICIONES_DEFECTO = 6;

/**
 * Cinta de texto que avanza (marquee), como en stringwebs.com. Anton en
 * mayúsculas con el monograma S entre repeticiones. Decorativa: aria-hidden
 * y quieta con prefers-reduced-motion. Solo en superficies de cartel.
 */
export function Cinta({
  texto,
  variante = "solida",
  duracionSegundos = 30,
  repeticiones = REPETICIONES_DEFECTO,
  className = "",
}: {
  texto: string;
  variante?: "solida" | "inversa";
  duracionSegundos?: number;
  repeticiones?: number;
  className?: string;
}) {
  const inversa = variante === "inversa";
  const fondo = inversa
    ? "bg-bg border-y-2 border-brand-green"
    : "bg-brand-green";
  const color = inversa ? "text-brand-green" : "text-on-brand";

  const grupo = (
    <span className="inline-flex">
      {Array.from({ length: repeticiones }).map((_, i) => (
        <span key={i} className="inline-flex items-center">
          <span
            className={`px-6 font-display text-[34px] uppercase leading-none ${color}`}
          >
            {texto}
          </span>
          <span
            className={`font-display text-[34px] uppercase leading-none opacity-45 ${color}`}
          >
            S
          </span>
        </span>
      ))}
    </span>
  );

  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden whitespace-nowrap py-3 ${fondo} ${className}`.trim()}
    >
      <div
        className="inline-flex animate-cinta motion-reduce:animate-none"
        style={{ animationDuration: `${duracionSegundos}s` }}
      >
        {grupo}
        {grupo}
      </div>
    </div>
  );
}
