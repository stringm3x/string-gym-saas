// GENERADO por scripts/authz-registry.mjs — no editar a mano.
// Regenerar: npm run authz:registry. Un export sin envolver aquí = error de tsc.
// Nadie importa este archivo en runtime: existe solo para que tsc lo compruebe.
import type { Modulo } from "./tipos";

import * as m0 from "@/app/(tenant)/[slug]/caja/actions";
import * as m1 from "@/app/(tenant)/[slug]/caja/autorizaciones-actions";
import * as m2 from "@/app/(tenant)/[slug]/caja/corte-actions";
import * as m3 from "@/app/(tenant)/[slug]/caja/mp-actions";
import * as m4 from "@/app/(tenant)/[slug]/miembros/[id]/creditos-actions";
import * as m5 from "@/app/(tenant)/[slug]/miembros/[id]/membresia-actions";
import * as m6 from "@/app/(tenant)/[slug]/miembros/[id]/nutricion-actions";
import * as m7 from "@/app/(tenant)/[slug]/miembros/[id]/renovar-actions";
import * as m8 from "@/app/(tenant)/[slug]/miembros/actions";
import * as m9 from "@/app/(tenant)/[slug]/miembros/importar/actions";
import * as m10 from "@/app/(tenant)/[slug]/miembros/qr-actions";
import * as m11 from "@/app/admin/(panel)/actions";
import * as m12 from "@/app/admin/(panel)/cuenta/actions";
import * as m13 from "@/app/admin/(panel)/eventos/actions";
import * as m14 from "@/app/admin/(panel)/solicitudes/actions";
import * as m15 from "@/app/admin/(panel)/tenants/[tenantId]/actions";
import * as m16 from "@/app/admin/login/actions";
import * as m17 from "@/app/kiosco/[slug]/actions";
import * as m18 from "@/app/portal/[slug]/actions";
import * as m19 from "@/app/portal/[slug]/clases/actions";
import * as m20 from "@/app/portal/[slug]/congelar-actions";
import * as m21 from "@/app/portal/[slug]/login/actions";
import * as m22 from "@/app/portal/[slug]/opinion-actions";
import * as m23 from "@/app/portal/[slug]/renovar/actions";

export const panel = [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10] satisfies ReadonlyArray<Modulo<"panel">>;
export const portal = [m18, m19, m20, m21, m22, m23] satisfies ReadonlyArray<Modulo<"portal">>;
export const kiosco = [m17] satisfies ReadonlyArray<Modulo<"kiosco">>;
export const admin = [m11, m12, m13, m14, m15, m16] satisfies ReadonlyArray<Modulo<"admin">>;
export const anon = [] satisfies ReadonlyArray<Modulo<"anon">>;
