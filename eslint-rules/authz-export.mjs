// Regla local: en un archivo "use server" bajo app/, todo export debe ser
// `export const x = <constructor de su clase>(...)`. Da el error en el
// editor, en la línea, sin esperar a tsc (lib/authz/__registry__.ts) ni al
// build. Los archivos listados en lib/authz/legacy.json (aún no migrados)
// se omiten hasta que salgan de esa lista.

import { readFileSync } from "node:fs";
import path from "node:path";

const CONSTRUCTORES = {
  panel: ["panelAction", "anonAction"],
  portal: ["portalAction", "anonAction"],
  kiosco: ["kioscoAction", "anonAction"],
  admin: ["adminAction", "anonAction"],
  anon: ["anonAction"],
};

const CLASES = [
  ["app/(tenant)/", "panel"],
  ["app/portal/", "portal"],
  ["app/kiosco/", "kiosco"],
  ["app/admin/", "admin"],
  ["app/(auth)/", "anon"],
  ["app/auth/", "anon"],
];

let legacyCache = null;
function esLegacy(cwd, rel) {
  if (!legacyCache) {
    try {
      legacyCache = new Set(
        JSON.parse(readFileSync(path.join(cwd, "lib/authz/legacy.json"), "utf8"))
      );
    } catch {
      legacyCache = new Set();
    }
  }
  return legacyCache.has(rel);
}

/** @type {import("eslint").Rule.RuleModule} */
const regla = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Toda Server Action debe declarar su autorización con el constructor de su clase (lib/authz).",
    },
    messages: {
      sinEnvolver:
        "Server Action sin autorización declarada. Usa `export const {{nombre}} = {{constructores}}(...)` — ver docs/autorizacion-acciones.md.",
      claseIncorrecta:
        "`{{usado}}` no es el constructor de esta carpeta. Aquí van: {{constructores}}.",
      carpetaSinClase:
        "Archivo \"use server\" en una carpeta sin clase de autorización. Agrega la carpeta a CLASES (eslint-rules/authz-export.mjs y scripts/authz-registry.mjs).",
    },
    schema: [],
  },
  create(context) {
    const cwd = context.cwd ?? process.cwd();
    const rel = path
      .relative(cwd, context.filename ?? context.getFilename())
      .split(path.sep)
      .join("/");
    if (!rel.startsWith("app/") || /\.test\.tsx?$/.test(rel)) return {};

    return {
      Program(node) {
        const primero = node.body[0];
        const useServer =
          primero &&
          primero.type === "ExpressionStatement" &&
          primero.directive === "use server";
        if (!useServer) return;
        if (esLegacy(cwd, rel)) return;

        const clase = CLASES.find(([p]) => rel.startsWith(p))?.[1];
        if (!clase) {
          context.report({ node: primero, messageId: "carpetaSinClase" });
          return;
        }
        const permitidos = CONSTRUCTORES[clase];
        const constructores = permitidos.join(" | ");

        for (const st of node.body) {
          if (st.type === "ExportDefaultDeclaration" || st.type === "ExportAllDeclaration") {
            context.report({
              node: st,
              messageId: "sinEnvolver",
              data: { nombre: "accion", constructores },
            });
            continue;
          }
          if (st.type !== "ExportNamedDeclaration" || st.exportKind === "type") continue;
          const d = st.declaration;
          if (!d) {
            // export { a, b } — no se puede verificar el origen: exige la forma directa.
            context.report({
              node: st,
              messageId: "sinEnvolver",
              data: { nombre: "accion", constructores },
            });
            continue;
          }
          if (d.type === "TSTypeAliasDeclaration" || d.type === "TSInterfaceDeclaration") continue;
          if (d.type === "FunctionDeclaration") {
            context.report({
              node: d.id ?? d,
              messageId: "sinEnvolver",
              data: { nombre: d.id?.name ?? "accion", constructores },
            });
            continue;
          }
          if (d.type === "VariableDeclaration") {
            for (const decl of d.declarations) {
              const init = decl.init;
              const nombre = decl.id.type === "Identifier" ? decl.id.name : "accion";
              const callee =
                init && init.type === "CallExpression" && init.callee.type === "Identifier"
                  ? init.callee.name
                  : null;
              if (!callee || !/Action$/.test(callee)) {
                context.report({
                  node: decl,
                  messageId: "sinEnvolver",
                  data: { nombre, constructores },
                });
              } else if (!permitidos.includes(callee)) {
                context.report({
                  node: init.callee,
                  messageId: "claseIncorrecta",
                  data: { usado: callee, constructores },
                });
              }
            }
          }
        }
      },
    };
  },
};

export default regla;
