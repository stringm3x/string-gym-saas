/**
 * Build del SDK: minifica public/sdk/string-gym.src.js → string-gym.js
 * (+ alias string-gym.min.js). Solo minifica (es un único archivo, sin bundle).
 *
 *   node scripts/build-sdk.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { transform } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public/sdk/string-gym.src.js");
const out = join(root, "public/sdk/string-gym.js");
const alias = join(root, "public/sdk/string-gym.min.js");

const code = readFileSync(src, "utf8");

const result = await transform(code, {
  minify: true,
  target: "es2018",
  loader: "js",
  legalComments: "inline", // conserva el banner /*! ... */
});

const banner = "";
writeFileSync(out, banner + result.code);
writeFileSync(alias, banner + result.code);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " KB";
console.log(`SDK minificado: ${kb(code)} → ${kb(result.code)}`);
console.log(" - public/sdk/string-gym.js");
console.log(" - public/sdk/string-gym.min.js");
