/**
 * Prueba de TIPOS (la corre tsc, no vitest): demuestra que el registro
 * generado rechaza un módulo con un export sin envolver, o envuelto con el
 * constructor de otra clase. Si alguno de los `@ts-expect-error` deja de
 * ser necesario, el diseño dejó de aguantar — no lo borres, arregla el tipo.
 */
import type { Modulo } from "./tipos";
import * as panelOk from "./__fixtures__/panel-ok";
import * as panelSinEnvolver from "./__fixtures__/panel-sin-envolver";
import * as panelClaseAjena from "./__fixtures__/panel-clase-ajena";

export const bien = [panelOk] satisfies ReadonlyArray<Modulo<"panel">>;

// @ts-expect-error — `export async function` sin panelAction no es Guarded.
export const mal1 = [panelSinEnvolver] satisfies ReadonlyArray<Modulo<"panel">>;

// @ts-expect-error — una kioscoAction no cabe en la carpeta del panel.
export const mal2 = [panelClaseAjena] satisfies ReadonlyArray<Modulo<"panel">>;
