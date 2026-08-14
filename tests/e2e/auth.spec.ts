import { test, expect } from "@playwright/test";
import { E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD, hasOwnerCreds } from "./helpers/env";

test.describe("Auth", () => {
  test("Login con credenciales correctas", async ({ page }) => {
    test.skip(
      !hasOwnerCreds,
      "Faltan E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD en .env.local"
    );

    await page.goto("/login");
    await page.getByLabel("Correo").fill(E2E_OWNER_EMAIL);
    // getByLabel("Contraseña") es ambiguo: también matchea el botón
    // "Mostrar contraseña". El id es estable (ver components/ui/Input.tsx).
    await page.locator("#password").fill(E2E_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    // El login redirige a /{slug}/hoy o /{slug}/dashboard según el plan.
    await expect(page).toHaveURL(/\/[^/]+\/(hoy|dashboard)/, {
      timeout: 10_000,
    });
  });

  test("Login con credenciales incorrectas", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo").fill("no-existe@example.com");
    await page.locator("#password").fill("password-incorrecto");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Credenciales incorrectas.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Recuperar contraseña", async ({ page }) => {
    await page.goto("/recuperar-password");
    await page.getByLabel("Correo").fill("cualquier@example.com");
    await page.getByRole("button", { name: "Enviar instrucciones" }).click();

    await expect(
      page.getByText("Te enviamos un email con instrucciones.")
    ).toBeVisible();
  });
});
