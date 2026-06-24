import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Alias "@" → raíz del proyecto, para que los tests resuelvan los imports
// "@/..." igual que la app (tsconfig paths). Vitest no lee tsconfig por sí solo.
// Extensión .mts (ESM) para evitar el loader CJS que choca con deps ESM-only.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
