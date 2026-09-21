/**
 * Logotipo en Anton girado en vertical, como firma al pie del menú lateral.
 * Es uso de logo (la voz que grita, muy bajita): tinta-tenue al 60 %, no
 * compite con la navegación. Decorativo: aria-hidden.
 */
export function LogotipoVertical({ texto = "STRING GYM" }: { texto?: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none mt-auto flex min-h-[160px] flex-1 items-end justify-start px-5 pb-2"
    >
      <span
        className="select-none font-display text-[40px] uppercase leading-none text-text-muted/60"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {texto}
      </span>
    </div>
  );
}
