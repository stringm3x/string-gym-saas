import { z } from "zod";

export const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

// Mismo valor que :root en app/globals.css (token de marca STRING).
export const DEFAULT_COLOR_ACENTO = "#50ff05"; // acido
/** Texto sobre el color de acento (negro sobre verde, como el logo). */
export const COLOR_TINTA_SOBRE_ACENTO = "#000000";

// color_sidebar / color_fondo dejaron de personalizarse (bloque plan/02-gating):
// el panel del staff siempre usa los colores STRING, solo el acento hacia el
// socio (portal, kiosco, QR, recibo) se personaliza. Las columnas se quedan
// en la base por ahora, sin leerse ni escribirse desde el código.
export const marcaColoresSchema = z.object({
  color_acento: z
    .string()
    .trim()
    .regex(HEX_REGEX, { error: "Color de acento inválido (usa #RRGGBB)" }),
});

export type MarcaColoresInput = z.infer<typeof marcaColoresSchema>;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB
export const LOGO_TIPOS_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const;

export const LOGO_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};
