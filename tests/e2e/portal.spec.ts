import { test, expect } from "@playwright/test";
import { loginAsMember } from "./helpers/auth";
import { E2E_GYM_SLUG } from "./helpers/env";
import { getMiembrosConEmail } from "./helpers/db";

/**
 * Un miembro distinto por test: solicitarCodigoAction aplica throttle de
 * 60s por miembro_id, y estos tests corren en segundos. Serial: loginAsMember
 * sustituye temporalmente el email del miembro por la dirección de prueba
 * de Resend (misma dirección para los 4), así que dos logins en paralelo
 * podrían resolver el miembro equivocado (findMiembroByIdentificador hace
 * match por email, sin más desambiguación).
 */
test.describe.serial("Portal del miembro", () => {
  let miembros: { id: string; nombre: string; email: string }[] = [];

  test.beforeAll(async () => {
    miembros = await getMiembrosConEmail(4);
    test.skip(
      miembros.length < 4,
      "gym-demo necesita al menos 4 miembros activos con email (¿corriste el seed?)"
    );
  });

  test("Login con OTP", async ({ page }) => {
    const miembro = miembros[0];
    await loginAsMember(page, miembro);
    await expect(page.getByText(miembro.nombre)).toBeVisible();
  });

  test("Ver membresía", async ({ page }) => {
    const miembro = miembros[1];
    await loginAsMember(page, miembro);
    await expect(
      page.getByText(/Membresía activa|Membresía vencida/)
    ).toBeVisible();
  });

  test("Ver nutrición", async ({ page }) => {
    const miembro = miembros[2];
    await loginAsMember(page, miembro);
    await expect(
      page.getByRole("heading", { name: "Mi plan de nutrición" })
    ).toBeVisible();
  });

  test("Ver recibos", async ({ page }) => {
    const miembro = miembros[3];
    await loginAsMember(page, miembro);
    await page.getByRole("link", { name: "Mis recibos" }).click();
    await page.waitForURL(`**/portal/${E2E_GYM_SLUG}/recibos`);
    await expect(
      page.getByRole("heading", { name: "Mis recibos" })
    ).toBeVisible();
  });
});
