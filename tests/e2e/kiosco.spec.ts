import { test, expect } from "@playwright/test";
import { E2E_GYM_SLUG } from "./helpers/env";
import { getMiembroConQr } from "./helpers/db";

/**
 * El kiosco es público (sin login) y en modo "lector" el input de texto
 * ES el mismo canal que usaría una pistola lectora bluetooth o la cámara:
 * escribir el qr_token ahí es equivalente a escanearlo.
 */
test.describe("Kiosco", () => {
  let qrToken = "";
  let miembroNombre = "";

  test.beforeAll(async () => {
    const miembro = await getMiembroConQr();
    test.skip(!miembro, "No hay miembros con qr_token en gym-demo (¿corriste el seed?)");
    if (miembro) {
      qrToken = miembro.qr_token;
      miembroNombre = miembro.nombre;
    }
  });

  test("Check-in con QR", async ({ page }) => {
    await page.goto(`/kiosco/${E2E_GYM_SLUG}`);
    await page
      .getByPlaceholder("Escanea o escribe tu código…")
      .fill(qrToken);
    await page.keyboard.press("Enter");

    await expect(page.getByText(`¡Bienvenido, ${miembroNombre}!`)).toBeVisible();
  });

  test("Compra de producto con código", async ({ page }) => {
    await page.goto(`/kiosco/${E2E_GYM_SLUG}`);
    await page.getByRole("button", { name: "Comprar" }).click();
    await page
      .getByPlaceholder("Escanea o escribe tu código…")
      .fill(qrToken);
    await page.keyboard.press("Enter");

    await expect(page.getByText(`Hola, ${miembroNombre}`)).toBeVisible();
    await page.getByRole("button", { name: "Agregar uno" }).first().click();
    await page.getByRole("button", { name: "Generar código" }).click();

    await expect(page.getByText(/Válido por \d+:\d+/)).toBeVisible();
  });

  test("Pago de membresía con código", async ({ page }) => {
    await page.goto(`/kiosco/${E2E_GYM_SLUG}`);
    await page.getByRole("button", { name: "Pagar membresía" }).click();
    await page
      .getByPlaceholder("Escanea o escribe tu código…")
      .fill(qrToken);
    await page.keyboard.press("Enter");

    await expect(page.getByText(`Hola, ${miembroNombre}`)).toBeVisible();
    await page.getByRole("button", { name: /Renovar|Contratar membresía/ }).click();

    await expect(page.getByText("Elige tu plan")).toBeVisible();
    await page.getByRole("button", { name: /Plan Mensual/ }).click();

    await page.getByRole("button", { name: "Efectivo" }).click();

    await expect(page.getByText(/Válido por \d+:\d+/)).toBeVisible();
  });
});
