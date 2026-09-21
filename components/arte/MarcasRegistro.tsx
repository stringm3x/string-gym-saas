// Marcas de registro de imprenta: una cruz fina en cada esquina del bloque
// que las contiene (el padre debe ser position: relative). Decorativas.
const ESQUINAS = [
  "left-2 top-2",
  "right-2 top-2",
  "left-2 bottom-2",
  "right-2 bottom-2",
];

export function MarcasRegistro({
  className = "text-text-muted",
}: {
  className?: string;
}) {
  return (
    <>
      {ESQUINAS.map((pos) => (
        <svg
          key={pos}
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`pointer-events-none absolute h-3 w-3 ${pos} ${className}`}
        >
          <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
          <circle
            cx="6"
            cy="6"
            r="3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      ))}
    </>
  );
}
