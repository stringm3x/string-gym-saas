import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import authzExport from "./eslint-rules/authz-export.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Toda Server Action bajo app/ declara su autorización (lib/authz).
  // Ver docs/autorizacion-acciones.md. Los archivos aún no migrados están
  // en lib/authz/legacy.json y la regla los omite.
  {
    files: ["app/**/*.ts", "app/**/*.tsx"],
    plugins: { authz: { rules: { "wrapped-export": authzExport } } },
    rules: { "authz/wrapped-export": "error" },
  },
]);

export default eslintConfig;
