// GENERADO por scripts/authz-registry.mjs — no editar a mano.
// Regenerar: npm run authz:registry. Un export sin envolver aquí = error de tsc.
// Nadie importa este archivo en runtime: existe solo para que tsc lo compruebe.
import type { Modulo } from "./tipos";

import * as m0 from "@/app/admin/(panel)/actions";
import * as m1 from "@/app/admin/(panel)/cuenta/actions";
import * as m2 from "@/app/admin/(panel)/eventos/actions";
import * as m3 from "@/app/admin/(panel)/solicitudes/actions";
import * as m4 from "@/app/admin/(panel)/tenants/[tenantId]/actions";
import * as m5 from "@/app/admin/login/actions";
import * as m6 from "@/app/kiosco/[slug]/actions";
import * as m7 from "@/app/portal/[slug]/actions";
import * as m8 from "@/app/portal/[slug]/clases/actions";
import * as m9 from "@/app/portal/[slug]/congelar-actions";
import * as m10 from "@/app/portal/[slug]/login/actions";
import * as m11 from "@/app/portal/[slug]/opinion-actions";
import * as m12 from "@/app/portal/[slug]/renovar/actions";

export const panel = [] satisfies ReadonlyArray<Modulo<"panel">>;
export const portal = [m7, m8, m9, m10, m11, m12] satisfies ReadonlyArray<Modulo<"portal">>;
export const kiosco = [m6] satisfies ReadonlyArray<Modulo<"kiosco">>;
export const admin = [m0, m1, m2, m3, m4, m5] satisfies ReadonlyArray<Modulo<"admin">>;
export const anon = [] satisfies ReadonlyArray<Modulo<"anon">>;
