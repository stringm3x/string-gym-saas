/**
 * Ilustraciones de trazo de la marca (mismas que stringwebs.com): objetos
 * concretos del negocio, trazo grueso monolineal, negro sobre ácido o sobre
 * papel. Decorativas (aria-hidden). Todas son `slice`: llenan el bloque que
 * las contiene y recortan lo que sobra.
 */

const ANTON = "var(--font-anton)";

interface Props {
  className?: string;
}

export function Libreta({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 312 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="312" height="200" className="fill-brand-green" />
      <g fill="none" className="stroke-on-brand" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 108 48 h 96 v 104 h -96 z" />
        <path d="M 126 74 h 60" />
        <path d="M 126 96 h 60" />
        <path d="M 126 118 h 34" />
        <path d="M 178 132 l 14 14 l 26 -30" />
      </g>
      <text x="286" y="182" fontFamily={ANTON} fontSize="22" className="fill-on-brand">S</text>
    </svg>
  );
}

export function Reloj({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 312 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="312" height="200" className="fill-brand-green" />
      <g fill="none" className="stroke-on-brand" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="156" cy="100" r="52" />
        <path d="M 156 68 v 34 l 24 16" />
        <path d="M 214 66 l 16 10 l -16 10" />
        <path d="M 196 58 c 20 -10 34 4 34 18" />
      </g>
      <text x="286" y="182" fontFamily={ANTON} fontSize="22" className="fill-on-brand">S</text>
    </svg>
  );
}

export function Tablero({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 312 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="312" height="200" className="fill-brand-green" />
      <g fill="none" className="stroke-on-brand" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="100" y="52" width="112" height="96" />
        <path d="M 118 128 v -26" />
        <path d="M 146 128 v -44" />
        <path d="M 174 128 v -16" />
        <path d="M 194 128 v -34" />
        <path d="M 100 76 h 112" />
      </g>
      <text x="286" y="182" fontFamily={ANTON} fontSize="22" className="fill-on-brand">S</text>
    </svg>
  );
}

export function Telefono({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 312 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="312" height="200" className="fill-brand-green" />
      <g fill="none" className="stroke-on-brand" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="118" y="44" width="76" height="118" rx="8" />
        <path d="M 134 76 h 44" />
        <path d="M 134 94 h 32" />
        <path d="M 134 120 h 44 v 24 l -18 -12 h -26 z" />
      </g>
      <text x="286" y="182" fontFamily={ANTON} fontSize="22" className="fill-on-brand">S</text>
    </svg>
  );
}

/** Mancuerna sobre papel con una brochada en ácido: la del caso Evolution GYM. */
export function Mancuerna({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 520 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="520" height="380" className="fill-paper" />
      <path
        d="M 40 300 C 140 286 250 280 360 288 C 420 292 470 300 500 308 L 500 330 C 460 320 410 312 358 308 C 248 300 140 306 40 320 Z"
        className="fill-brand-green"
      />
      <g fill="none" className="stroke-paper-ink" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 150 190 h 220" strokeWidth="12" />
        <g strokeWidth="10">
          <rect x="106" y="158" width="38" height="64" rx="6" />
          <rect x="376" y="158" width="38" height="64" rx="6" />
          <rect x="74" y="172" width="28" height="36" rx="6" />
          <rect x="418" y="172" width="28" height="36" rx="6" />
        </g>
      </g>
      <text x="488" y="358" fontFamily={ANTON} fontSize="26" className="fill-paper-ink">S</text>
    </svg>
  );
}

export const ILUSTRACIONES = { libreta: Libreta, reloj: Reloj, tablero: Tablero, telefono: Telefono, mancuerna: Mancuerna } as const;
export type IlustracionNombre = keyof typeof ILUSTRACIONES;
