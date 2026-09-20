/**
 * Toda página o layout del panel que necesite contexto de tenant lo obtiene
 * vía requirePanel(politica) — no vía getTenant() directo — para que su gate
 * lea la misma política que su acción. Las excepciones están listadas aquí
 * con su razón; agregar una nueva exige tocar esta lista (y explicarla).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const PANEL = path.join(root, "app/(tenant)/[slug]");

/** Páginas que resuelven el tenant sin requirePanel, y por qué. */
const SIN_POLITICA: Record<string, string> = {
  "layout.tsx": "layout raíz: valida sesión/tenant/staff, no gatea por política",
  "suspendida/page.tsx": "el gym está bloqueado; solo ofrece cerrar sesión (anónima)",
  "miembros/page.tsx": "listado base de Starter, sin acción propia; todos los roles",
  "miembros/[id]/page.tsx": "ficha del socio: cada bloque gatea su feature/permiso por separado",
  "recibos/[pagoId]/page.tsx": "solo lectura por token/id; anular gatea con cancelar_pagos en la UI",
  "recibos/ticket/[ticketId]/page.tsx": "solo lectura",
  "inventario/productos/page.tsx": "cubierta por inventario/layout.tsx (pagina.inventario)",
  "inventario/movimientos/page.tsx": "cubierta por inventario/layout.tsx (pagina.inventario)",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n === "page.tsx" || n === "layout.tsx") out.push(p);
  }
  return out;
}

describe("páginas del panel y requirePanel", () => {
  const paginas = walk(PANEL).map((p) => ({
    rel: path.relative(PANEL, p).split(path.sep).join("/"),
    src: readFileSync(p, "utf8"),
  }));

  it("hay páginas que revisar", () => {
    expect(paginas.length).toBeGreaterThan(30);
  });

  it("toda página que resuelve tenant usa requirePanel, salvo las listadas con razón", () => {
    const sinPolitica = paginas
      // Llamada real, no una mención en un comentario.
      .filter((p) => /\bgetTenant\(\)/.test(p.src) && !/await requirePanel\(/.test(p.src))
      .map((p) => p.rel)
      .sort();
    expect(sinPolitica).toEqual(Object.keys(SIN_POLITICA).sort());
  });

  it("ninguna página gatea con role === \"owner\" a mano (no existe permiso solo-owner)", () => {
    const literales = paginas
      .filter((p) => /role (===|!==) "owner"/.test(p.src))
      .map((p) => p.rel)
      .sort();
    // Los que quedan no son gates de página sino UI de un bloque; ver PR 9b.
    expect(literales).toEqual(["caja/page.tsx", "layout.tsx"]);
  });
});
