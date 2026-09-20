import { describe, it, expect } from "vitest";
import path from "node:path";
import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import regla from "@/eslint-rules/authz-export.mjs";

const root = path.resolve(__dirname, "../..");

function lint(codigo: string, rel: string): string[] {
  const linter = new Linter({ cwd: root });
  const mensajes = linter.verify(
    codigo,
    [
      {
        files: ["**/*.ts"],
        plugins: { authz: { rules: { "wrapped-export": regla } } },
        languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
        rules: { "authz/wrapped-export": "error" },
      },
    ],
    path.join(root, rel)
  );
  return mensajes.map((m) => m.messageId ?? m.message);
}

const PANEL = "app/(tenant)/[slug]/x-nuevo/actions.ts";

describe("regla authz/wrapped-export", () => {
  it("acepta export const con el constructor de la carpeta", () => {
    expect(
      lint(
        `"use server";
import { panelAction, anonAction } from "@/lib/authz";
export const a = panelAction("caja.cobrar", {}, async () => ({ ok: true }));
export const b = anonAction("cerrar_sesion_staff", async () => ({ ok: true }));
export type Estado = { ok: boolean };`,
        PANEL
      )
    ).toEqual([]);
  });

  it("rechaza export async function (la acción 152)", () => {
    expect(lint(`"use server";\nexport async function nueva() { return { ok: true }; }`, PANEL)).toEqual([
      "sinEnvolver",
    ]);
  });

  it("rechaza el constructor de otra carpeta", () => {
    expect(
      lint(
        `"use server";
import { kioscoAction } from "@/lib/authz";
export const a = kioscoAction("kiosco.checkin", { onDenied: () => ({ ok: false }) }, async () => ({ ok: true }));`,
        PANEL
      )
    ).toEqual(["claseIncorrecta"]);
  });

  it("rechaza export { x } y export default", () => {
    expect(
      lint(`"use server";\nconst x = async () => {};\nexport { x };\nexport default x;`, PANEL)
    ).toEqual(["sinEnvolver", "sinEnvolver"]);
  });

  it("ignora archivos sin 'use server' y archivos legacy", () => {
    expect(lint(`export async function libre() {}`, PANEL)).toEqual([]);
    expect(
      lint(`"use server";\nexport async function vieja() {}`, "app/(tenant)/[slug]/caja/actions.ts")
    ).toEqual([]);
  });

  it("señala una carpeta sin clase", () => {
    expect(lint(`"use server";\nexport async function x() {}`, "app/otra/actions.ts")).toEqual([
      "carpetaSinClase",
    ]);
  });
});
