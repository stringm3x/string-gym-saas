import { expect, type Page } from "@playwright/test";
import { E2E_GYM_SLUG, E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD } from "./env";
import { clearOtpThrottle, setMiembroEmail, setOtpCode } from "./db";

/** Login por UI como owner de gym-demo. Deja al usuario en /{slug}/(hoy|dashboard). */
export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(E2E_OWNER_EMAIL);
  await page.locator("#password").fill(E2E_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/[^/]+\/(hoy|dashboard)/, { timeout: 10_000 });
}

const OTP_TEST_CODE = "123456";
// Resend rechaza @example.com ("usa nuestra dirección de prueba"); esta es
// la dirección oficial de Resend para pruebas — siempre "entrega" sin
// requerir dominio verificado. https://resend.com/docs/dashboard/emails/send-test-emails
const RESEND_TEST_EMAIL = "delivered@resend.dev";

/**
 * Login por UI en el portal del miembro vía OTP por correo. El email del
 * miembro (@example.com, del seed) no es una dirección real que Resend
 * pueda entregar, así que se sustituye temporalmente por la dirección de
 * prueba de Resend, y se restaura al terminar. El código en sí tampoco es
 * legible desde el test (solo se guarda el hash), así que se sobrescribe
 * en la BD con un valor conocido — ver helpers/db.ts.
 */
export async function loginAsMember(
  page: Page,
  miembro: { id: string; email: string }
): Promise<void> {
  const emailOriginal = miembro.email;
  await clearOtpThrottle(miembro.id);
  await setMiembroEmail(miembro.id, RESEND_TEST_EMAIL);
  try {
    await page.goto(`/portal/${E2E_GYM_SLUG}/login`);
    await page
      .getByPlaceholder("55 1234 5678 o tu@correo.com")
      .fill(RESEND_TEST_EMAIL);
    await page.getByRole("button", { name: "Enviar código" }).click();

    await expect(page.getByPlaceholder("______")).toBeVisible();
    await setOtpCode(miembro.id, OTP_TEST_CODE);

    await page.getByPlaceholder("______").fill(OTP_TEST_CODE);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(`**/portal/${E2E_GYM_SLUG}`, { timeout: 10_000 });
  } finally {
    await setMiembroEmail(miembro.id, emailOriginal);
  }
}
