/**
 * Credenciales del gym de prueba. No se inventan valores por defecto para
 * email/password: si faltan, los tests que los necesitan se saltan con un
 * mensaje explícito en vez de fallar en rojo o pegarle a datos incorrectos.
 */
export const E2E_GYM_SLUG = process.env.E2E_GYM_SLUG ?? "gym-demo";
export const E2E_OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "";
export const E2E_OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "";

export const hasOwnerCreds = Boolean(E2E_OWNER_EMAIL && E2E_OWNER_PASSWORD);
