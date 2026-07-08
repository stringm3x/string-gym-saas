// Contraste WCAG entre dos colores hex (#RRGGBB). Se usa en la personalización
// de marca para avisar de combinaciones poco legibles.

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function canalLineal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminancia(hex: string): number | null {
  const c = parseHex(hex);
  if (!c) return null;
  return (
    0.2126 * canalLineal(c.r) +
    0.7152 * canalLineal(c.g) +
    0.0722 * canalLineal(c.b)
  );
}

/** Ratio de contraste WCAG (1 = nulo, 21 = máximo). 0 si algún hex es inválido. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return 0;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
