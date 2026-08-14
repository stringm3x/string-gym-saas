import { test, expect } from "@playwright/test";
import { loginAsOwner } from "./helpers/auth";
import { E2E_GYM_SLUG, hasOwnerCreds } from "./helpers/env";

test.describe("Caja", () => {
  test.skip(!hasOwnerCreds, "Faltan E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD en .env.local");

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/${E2E_GYM_SLUG}/caja`);
  });

  test("Registrar cobro de membresía", async ({ page }) => {
    // Concepto "Membresía" es el default; falta elegir un miembro.
    await page
      .getByPlaceholder("Buscar miembro por nombre o teléfono…")
      .fill("an");
    // La lista de resultados del autocomplete es la que muestra teléfonos
    // (+52…); la distingue de la lista de "Movimientos de hoy".
    const resultado = page.locator("ul").filter({ hasText: "+52" }).getByRole("button").first();
    await expect(resultado).toBeVisible();
    await resultado.click();

    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("Pago registrado", { exact: true })).toBeVisible();
  });

  test("Registrar visita sin miembro", async ({ page }) => {
    await page.getByRole("button", { name: "Visita", exact: true }).click();
    // Sin seleccionar miembro: monto directo, queda como "Visitante".
    await page.getByLabel("Monto").fill("50");
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("Pago registrado")).toBeVisible();
  });

  test("Registrar venta de producto", async ({ page }) => {
    await page.getByRole("button", { name: "Producto", exact: true }).click();
    // Primera card de "Catálogo" (poblada por el seed de gym-demo).
    await page.getByText("Catálogo").locator("..").getByRole("button").first().click();
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("Pago registrado")).toBeVisible();
  });

  test("Abrir y cerrar corte de caja", async ({ page }) => {
    // Estado conocido: si ya hay un turno abierto (de una corrida previa
    // interrumpida), se cierra primero para dejar el flujo determinista.
    if (await page.getByRole("button", { name: "Cerrar turno" }).isVisible()) {
      await page.getByLabel("Efectivo contado").fill("0");
      await page.getByRole("button", { name: "Cerrar turno" }).click();
      await expect(page.getByText("Turno cerrado")).toBeVisible();
    }

    await page.getByLabel("Fondo inicial (efectivo)").fill("500");
    await page.getByRole("button", { name: "Abrir turno" }).click();
    await expect(page.getByText("Turno abierto")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar turno" })).toBeVisible();

    await page.getByLabel("Efectivo contado").fill("500");
    await page.getByRole("button", { name: "Cerrar turno" }).click();
    await expect(page.getByText("Turno cerrado")).toBeVisible();
  });
});
