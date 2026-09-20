import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  generar,
  listarUseServer,
  claseDe,
  REGISTRY_PATH,
} from "@/scripts/authz-registry.mjs";

const root = path.resolve(__dirname, "../..");

describe("registro de autorización", () => {
  it("__registry__.ts está fresco (npm run authz:registry)", () => {
    const actual = readFileSync(path.join(root, REGISTRY_PATH), "utf8");
    expect(actual).toBe(generar(root));
  });

  it("no existe lista de módulos pendientes: todo 'use server' pasa por el registro", () => {
    expect(existsSync(path.join(root, "lib/authz/legacy.json"))).toBe(false);
    const enRegistro = generar(root);
    for (const rel of listarUseServer(root)) {
      expect(enRegistro).toContain(`"@/${rel.replace(/\.tsx?$/, "")}"`);
    }
  });

  it("todo módulo 'use server' bajo app/ tiene clase de autorización", () => {
    for (const rel of listarUseServer(root)) {
      expect(claseDe(rel), `${rel}: carpeta sin clase`).not.toBeNull();
    }
  });
});
