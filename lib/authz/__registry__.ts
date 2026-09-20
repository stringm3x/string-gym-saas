// GENERADO por scripts/authz-registry.mjs — no editar a mano.
// Regenerar: npm run authz:registry. Un export sin envolver aquí = error de tsc.
// Nadie importa este archivo en runtime: existe solo para que tsc lo compruebe.
import type { Modulo } from "./tipos";

import * as m0 from "@/app/kiosco/[slug]/actions";
import * as m1 from "@/app/portal/[slug]/actions";
import * as m2 from "@/app/portal/[slug]/clases/actions";
import * as m3 from "@/app/portal/[slug]/congelar-actions";
import * as m4 from "@/app/portal/[slug]/login/actions";
import * as m5 from "@/app/portal/[slug]/opinion-actions";
import * as m6 from "@/app/portal/[slug]/renovar/actions";

export const panel = [] satisfies ReadonlyArray<Modulo<"panel">>;
export const portal = [m1, m2, m3, m4, m5, m6] satisfies ReadonlyArray<Modulo<"portal">>;
export const kiosco = [m0] satisfies ReadonlyArray<Modulo<"kiosco">>;
export const admin = [] satisfies ReadonlyArray<Modulo<"admin">>;
export const anon = [] satisfies ReadonlyArray<Modulo<"anon">>;
