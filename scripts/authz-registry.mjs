// Genera lib/authz/__registry__.ts: importa todos los módulos "use server"
// de app/ y los somete a `satisfies Modulo<clase>` según su carpeta. Así
// tsc (y por tanto `next build`) falla si un export no está envuelto con
// el constructor de su clase. Sin excepciones: no hay lista de módulos
// pendientes (legacy.json murió en el PR 8).
//
//   node scripts/authz-registry.mjs          escribe el registro
//   node scripts/authz-registry.mjs --check  falla si está desactualizado

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REGISTRY_PATH = "lib/authz/__registry__.ts";

/** Carpeta → clase. Un módulo "use server" fuera de estas carpetas es un error. */
const CLASES = [
  ["app/(tenant)/", "panel"],
  ["app/portal/", "portal"],
  ["app/kiosco/", "kiosco"],
  ["app/admin/", "admin"],
  ["app/(auth)/", "anon"],
  ["app/auth/", "anon"],
];

export function claseDe(rel) {
  const hit = CLASES.find(([prefijo]) => rel.startsWith(prefijo));
  return hit ? hit[1] : null;
}

const USE_SERVER =
  /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']\s*;?/;

export function esUseServer(contenido) {
  return USE_SERVER.test(contenido.slice(0, 2000));
}

function walk(dir, out) {
  for (const nombre of readdirSync(dir)) {
    const p = path.join(dir, nombre);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) out.push(p);
  }
  return out;
}

/** Rutas (relativas a root, con "/") de todos los módulos "use server" bajo app/. */
export function listarUseServer(root) {
  return walk(path.join(root, "app"), [])
    .filter((p) => esUseServer(readFileSync(p, "utf8")))
    .map((p) => path.relative(root, p).split(path.sep).join("/"))
    .sort();
}

export function generar(root) {
  const modulos = listarUseServer(root);

  const porClase = { panel: [], portal: [], kiosco: [], admin: [], anon: [] };
  const imports = [];
  modulos.forEach((rel, i) => {
    const clase = claseDe(rel);
    if (!clase) {
      throw new Error(
        `${rel}: carpeta sin clase de autorización. Agrega la regla en scripts/authz-registry.mjs (CLASES).`
      );
    }
    const alias = `m${i}`;
    imports.push(`import * as ${alias} from "@/${rel.replace(/\.tsx?$/, "")}";`);
    porClase[clase].push(alias);
  });

  const arrays = Object.entries(porClase).map(
    ([clase, aliases]) =>
      `export const ${clase} = [${aliases.join(", ")}] satisfies ReadonlyArray<Modulo<"${clase}">>;`
  );

  return [
    "// GENERADO por scripts/authz-registry.mjs — no editar a mano.",
    "// Regenerar: npm run authz:registry. Un export sin envolver aquí = error de tsc.",
    "// Nadie importa este archivo en runtime: existe solo para que tsc lo compruebe.",
    'import type { Modulo } from "./tipos";',
    ...(imports.length ? ["", ...imports] : []),
    "",
    ...arrays,
    "",
  ].join("\n");
}

const esMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esMain) {
  const root = process.cwd();
  const contenido = generar(root);
  const destino = path.join(root, REGISTRY_PATH);
  if (process.argv.includes("--check")) {
    let actual = "";
    try {
      actual = readFileSync(destino, "utf8");
    } catch {}
    if (actual !== contenido) {
      console.error(`${REGISTRY_PATH} desactualizado: corre npm run authz:registry`);
      process.exit(1);
    }
  } else {
    writeFileSync(destino, contenido);
    console.log(`${REGISTRY_PATH} regenerado`);
  }
}
