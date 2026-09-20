/**
 * Tipos del sistema de autorización de Server Actions.
 * Diseño completo: docs/autorizacion-acciones.md.
 */

/** Clase de acción. Determina qué contexto se resuelve y qué ejes se exigen. */
export type Kind = "panel" | "portal" | "kiosco" | "admin" | "anon";

/**
 * Marca que los constructores pegan a la función envuelta. `Symbol.for`
 * para que sobreviva a duplicación de módulos entre bundles.
 */
export const AUTHZ: unique symbol = Symbol.for("string-gym.authz");

/** Una Server Action envuelta por el constructor de la clase K. */
export type Guarded<K extends Kind, A extends unknown[], R> = ((
  ...args: A
) => Promise<R>) & { readonly [AUTHZ]: K };

/**
 * Forma que debe tener un módulo `"use server"` de la carpeta de la clase
 * K: todos sus exports son acciones de esa clase, o anónimas (login,
 * cerrar sesión), que se permiten en cualquier carpeta porque su propósito
 * está enumerado en `PropositoAnon`.
 */
export type Modulo<K extends Kind> = Record<
  string,
  Guarded<K, never[], unknown> | Guarded<"anon", never[], unknown>
>;

export type AuthzCode =
  | "SIN_PLAN"
  | "SIN_PERMISO"
  | "SIN_SESION"
  | "IDENTIDAD_INVALIDA"
  | "GYM_NO_ENCONTRADO";

/** Resultado estándar cuando la autorización falla. */
export interface Denegado {
  ok: false;
  error: string;
  code: AuthzCode;
}

/**
 * Si el tipo de retorno R de la acción absorbe `Denegado` (p. ej.
 * `{ ok: boolean; error?: string }`), `onDenied` es opcional. Si no
 * (`fieldErrors` obligatorio, `Nota[]`, `number`, `{ success }`…), tsc
 * obliga a declarar cómo se expresa la denegación en esa forma.
 */
export type OnDenied<R> = [Denegado] extends [R]
  ? { onDenied?: (d: Denegado) => NoInfer<R> }
  : { onDenied: (d: Denegado) => NoInfer<R> };
