// GENERADO por scripts/authz-registry.mjs — no editar a mano.
// Regenerar: npm run authz:registry. Un export sin envolver aquí = error de tsc.
// Nadie importa este archivo en runtime: existe solo para que tsc lo compruebe.
import type { Modulo } from "./tipos";

import * as m0 from "@/app/kiosco/[slug]/actions";

export const panel = [] satisfies ReadonlyArray<Modulo<"panel">>;
export const portal = [] satisfies ReadonlyArray<Modulo<"portal">>;
export const kiosco = [m0] satisfies ReadonlyArray<Modulo<"kiosco">>;
export const admin = [] satisfies ReadonlyArray<Modulo<"admin">>;
export const anon = [] satisfies ReadonlyArray<Modulo<"anon">>;
