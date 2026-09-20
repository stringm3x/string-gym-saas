import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  generar,
  listarUseServer,
  leerLegacy,
  claseDe,
  esUseServer,
  REGISTRY_PATH,
} from "@/scripts/authz-registry.mjs";

const root = path.resolve(__dirname, "../..");

/**
 * Techo de la lista legacy. Baja este número en cada PR de migración; nunca
 * subirlo. Cuando llegue a 0 se borra legacy.json y este test.
 */
const LEGACY_MAX = 17;

describe("registro de autorización", () => {
  it("__registry__.ts está fresco (npm run authz:registry)", () => {
    const actual = readFileSync(path.join(root, REGISTRY_PATH), "utf8");
    expect(actual).toBe(generar(root));
  });

  it("legacy.json solo puede encoger", () => {
    const legacy: string[] = leerLegacy(root);
    expect(legacy.length).toBeLessThanOrEqual(LEGACY_MAX);
    expect(new Set(legacy).size).toBe(legacy.length);
  });

  it("todo módulo en legacy.json existe y sigue siendo 'use server'", () => {
    for (const rel of leerLegacy(root) as string[]) {
      const p = path.join(root, rel);
      expect(existsSync(p), `${rel} ya no existe: quítalo de legacy.json`).toBe(true);
      expect(esUseServer(readFileSync(p, "utf8")), `${rel} ya no es "use server"`).toBe(true);
    }
  });

  it("todo módulo 'use server' bajo app/ tiene clase de autorización", () => {
    for (const rel of listarUseServer(root)) {
      expect(claseDe(rel), `${rel}: carpeta sin clase`).not.toBeNull();
    }
  });

  it("un módulo 'use server' nuevo entra al registro salvo que esté en legacy", () => {
    const legacy = new Set(leerLegacy(root) as string[]);
    const enRegistro = generar(root);
    for (const rel of listarUseServer(root)) {
      if (legacy.has(rel)) {
        expect(enRegistro).not.toContain(`"@/${rel.replace(/\.tsx?$/, "")}"`);
      } else {
        expect(enRegistro).toContain(`"@/${rel.replace(/\.tsx?$/, "")}"`);
      }
    }
  });
});
