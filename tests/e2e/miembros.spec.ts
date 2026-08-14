import { test, expect } from "@playwright/test";
import { loginAsOwner } from "./helpers/auth";
import { E2E_GYM_SLUG, hasOwnerCreds } from "./helpers/env";

/**
 * Serial: cada test opera sobre el MISMO miembro creado en el primero
 * (crear → editar → pago → check-in → congelar → descongelar), como en un
 * flujo real de operación. Corre contra gym-demo real; el miembro de prueba
 * queda archivado al final (ver último test) para no ensuciar la demo.
 * Reset total disponible con `npx tsx scripts/seed-gym-demo.ts`.
 */
test.describe.serial("Miembros", () => {
  test.skip(!hasOwnerCreds, "Faltan E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD en .env.local");

  const nombre = `E2E Miembro ${Date.now()}`;
  const telefono = "55 0000 1234";
  let miembroUrl = "";

  test("Crear miembro nuevo", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/${E2E_GYM_SLUG}/miembros`);
    await page.getByRole("link", { name: "Nuevo miembro" }).click();
    await page.waitForURL(/\/miembros\/nuevo$/);

    await page.getByLabel("Nombre completo").fill(nombre);
    await page.getByLabel("Teléfono").fill(telefono);
    await page.getByRole("button", { name: "Registrar miembro" }).click();

    await page.waitForURL(/\/miembros\/[0-9a-f-]{36}$/, { timeout: 10_000 });
    miembroUrl = page.url();
    await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
  });

  test("Editar miembro", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(miembroUrl);

    const nuevoTelefono = "55 9999 8888";
    await page.getByLabel("Teléfono").fill(nuevoTelefono);
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Miembro actualizado")).toBeVisible();
    await expect(page.getByLabel("Teléfono")).toHaveValue(nuevoTelefono);
  });

  test("Registrar pago", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(miembroUrl);

    await page.getByRole("button", { name: "Renovar" }).click();
    await page.getByRole("button", { name: "Cobrar renovación" }).click();

    // Redirige al recibo del pago recién creado.
    await page.waitForURL(/\/recibos\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  });

  test("Check-in manual", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(miembroUrl);

    await page.getByRole("button", { name: "Registrar check-in" }).click();
    await expect(page.getByText("Check-in registrado")).toBeVisible();
  });

  test("Congelar membresía", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(miembroUrl);

    await page.getByRole("button", { name: "Congelar", exact: true }).click();
    const fin = new Date();
    fin.setDate(fin.getDate() + 7);
    await page.getByLabel("Fin").fill(fin.toISOString().slice(0, 10));
    await page.getByRole("dialog").getByRole("button", { name: "Congelar" }).click();

    await expect(page.getByText("Membresía congelada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Descongelar" })).toBeVisible();
  });

  test("Descongelar membresía", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(miembroUrl);

    await expect(page.getByRole("button", { name: "Descongelar" })).toBeVisible();
    await page.getByRole("button", { name: "Descongelar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Descongelar" })
      .click();

    await expect(page.getByText("Membresía descongelada")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Congelar", exact: true })
    ).toBeVisible();

    // Limpieza: el miembro de prueba no debe quedar activo en el gym de demo.
    await page.getByRole("button", { name: /Archivar/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Archivar/ })
      .click();
    await expect(page.getByText(/[Aa]rchivado/)).toBeVisible();
  });
});
