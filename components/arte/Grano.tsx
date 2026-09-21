const NOISE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
  <filter id='grano'>
    <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch' />
    <feColorMatrix type='saturate' values='0' />
  </filter>
  <rect width='100%' height='100%' filter='url(#grano)' />
</svg>`;

const NOISE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}`;

/**
 * Textura de grano de impresión (misma pieza que stringwebs.com). Es una
 * imagen de 200px que el navegador repite, no un filtro en vivo. Con
 * mix-blend overlay no toca el negro puro: solo "imprime" sobre el ácido,
 * el papel y las superficies elevadas, que es justo el efecto de serigrafía.
 *
 * `opacidad`: 0.3 en superficies de cartel (acceso, kiosco, portal); 0.08 en
 * el panel de trabajo, donde a distancia de lectura no se percibe.
 */
export function Grano({
  opacidad = 0.3,
  fijo = true,
}: {
  opacidad?: number;
  /** fixed a toda la pantalla (default) o absolute dentro de un padre relative. */
  fijo?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none inset-0 z-[9999] mix-blend-overlay ${
        fijo ? "fixed" : "absolute"
      }`}
      style={{
        opacity: opacidad,
        backgroundImage: `url("${NOISE_DATA_URI}")`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}
