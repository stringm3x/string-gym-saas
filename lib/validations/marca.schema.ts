import { z } from "zod";

export const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const DEFAULT_COLOR_ACENTO = "#50ff05";
export const DEFAULT_COLOR_SIDEBAR = "#141414";
export const DEFAULT_COLOR_FONDO = "#0a0a0a";

export const marcaColoresSchema = z.object({
  color_acento: z
    .string()
    .trim()
    .regex(HEX_REGEX, { error: "Color de acento inválido (usa #RRGGBB)" }),
  color_sidebar: z
    .string()
    .trim()
    .regex(HEX_REGEX, { error: "Color de sidebar inválido (usa #RRGGBB)" }),
  color_fondo: z
    .string()
    .trim()
    .regex(HEX_REGEX, { error: "Color de fondo inválido (usa #RRGGBB)" }),
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
