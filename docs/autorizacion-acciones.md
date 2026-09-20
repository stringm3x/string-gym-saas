# Autorización de Server Actions

Diseño aprobado el 2026-09-19. Este documento es la referencia para
releerlo en seis meses: por qué existe `lib/authz/`, cómo se usa, qué
garantiza y qué **no** garantiza.

## 1. El problema

De ~156 acciones y endpoints (143 Server Actions en 53 archivos
`"use server"` + 13 route handlers), la auditoría de septiembre 2026
encontró: 16 que no verificaban nada, 6 que verificaban plan pero no rol,
18 que verificaban rol pero no el plan del módulo Pro correspondiente, y 1
con auth pero sin validar dueño del recurso. Se corrigieron a mano las más
graves (bloques 01–04b), pero el patrón se repetía porque **no había un
lugar donde se decidiera quién puede hacer qué**: cada acción improvisaba
sus `if (!hasPermission(...))`, y la siguiente nacía sin ninguno.

Objetivo: que sea imposible escribir una Server Action sin declarar los dos
ejes — feature del plan (`hasFeature`) y permiso del rol (`hasPermission`)
— y que cuando alguno no aplique haya que decirlo en el código de forma
explícita, no dejarlo en blanco.

## 2. Verificación previa: los headers del proxy no se pueden falsificar

Todo el panel confía en `x-staff-role`/`x-tenant-*` que pone `proxy.ts`.
Antes de construir nada se verificó (2026-09-19) que un cliente no puede
inyectarlos:

- **Reproducción aislada** (Next 16.2.9, mismo patrón de proxy): route
  handler y Server Action llamados directo con `x-staff-role: SPOOF` →
  `headers()` devolvió siempre el valor del proxy.
- **App real**, dev local, sesión del owner de `gym-demo`: llamada directa
  a `getReporteCsvAction` (gateada por `ver_dashboard_ingresos`) con
  `x-staff-role: entrenador` → `{ ok: true, csv: … }`; el spoof no bajó el
  rol. Se probó "hacia abajo" con owner porque crear un recepcionista es
  escribir en la base de producción; la pregunta ("¿qué valor llega a
  `headers()`?") es simétrica.

Pero ese comportamiento — `response.headers.set()` pisando lo que venga en
la request — **no está documentado**: la doc de Next dice que para hacer
headers visibles a `headers()` se usa `NextResponse.next({ request: {
headers } })`. Por eso el PR 0 cambió el proxy a esa forma y además
**borra siempre** los cinco headers de contexto de toda request entrante,
también en rutas públicas (kiosco, portal, api), donde antes devolvía
antes de setearlos y llegaba lo que mandara el cliente. Cerrarlo antes de
que `kioscoAction`/`portalAction` empezaran a resolver contexto ahí era el
orden correcto. Efecto colateral: los headers ya no viajan al navegador
como response headers.

`getTenant()` dejó de hacer default a `owner` cuando falta el header (era
fail-open); ahora valida los cuatro valores y lanza.

## 3. Alternativas descartadas

- **RLS por rol en Postgres**: la más fuerte, pero la RLS actual es de
  aislamiento por tenant (y `gyms` solo deja escribir al owner); llevar 25
  permisos × 4 roles a policies es un proyecto de base de semanas y no
  cubre plan.
- **Autorizar en `lib/queries`** (Data Access Layer): más superficie, pero
  ~100 funciones sin rol ni plan en su firma; la migración más cara.
- **`next-safe-action`**: hace el 70 %, pero su forma de resultado choca
  con la convención `{ ok, error }` y obligaría a reescribir todos los
  `useActionState`.

El helper en la frontera de la acción es correcto porque esa frontera es
la que fuga, **con la condición** de que la decisión viva en un solo
archivo de políticas y páginas y acciones lo consulten igual (PR 9).

## 4. Piezas

```
lib/authz/
  politicas.ts        EL lugar: PANEL / PORTAL / KIOSCO / ADMIN / PropositoAnon
  index.ts            panelAction / portalAction / kioscoAction / adminAction / anonAction
  tipos.ts            Guarded, Modulo, Denegado, OnDenied, AUTHZ
  __registry__.ts     GENERADO: todos los módulos "use server" bajo `satisfies`
  legacy.json         módulos aún no migrados (solo puede encoger)
  *.test.ts           registro, constructores, regla ESLint
  tipos.typetest.ts   prueba de tipos: el registro rechaza exports sin envolver
scripts/authz-registry.mjs      genera __registry__.ts (--check en prebuild/pretest)
eslint-rules/authz-export.mjs   error en el editor si un export no está envuelto
lib/permissions.ts              + usar_panel, PERMISSION_LABELS
```

### 4.1 `politicas.ts`: dónde se decide

Cada acción declara una política **por su clave**; no puede inventar la
suya. La clave es el id de la acción en el log, en este doc y (PR 9) en el
gate de su página.

| Clase | Carpeta | Declara | Quién prueba la identidad |
|---|---|---|---|
| `PANEL` | `app/(tenant)/**` | `feature` + `permission`, siempre | proxy.ts (sesión staff → headers) |
| `PORTAL` | `app/portal/**` | `feature` (más `portal_miembro` implícita) | cookie OTP del socio (`getPortalSession`) |
| `KIOSCO` | `app/kiosco/**` | `feature` | `qr_token` → `ctx.miembro` |
| `ADMIN` | `app/admin/**` | `rol` (`admin` / `super_admin`) | `string_admins` activo |
| `PropositoAnon` | cualquiera | propósito de una unión cerrada | nadie, por definición |

Reglas:

- **Panel, "cualquier plan"**: se declara la feature descriptiva de Starter
  que corresponda (`miembros`, `caja_basica`, `checkins`…). Es verdad y
  verificable; no hay "sin feature".
- **Panel, "cualquier rol"**: se declara `usar_panel`. **No es un
  permiso: es la ausencia declarada de uno.** Lo tienen los cuatro roles,
  así que significa "cualquier staff autenticado en este gym". Existe para
  que la decisión sea explícita y greppable; no lo leas como una
  restricción real.
- **Dos features o permisos condicionales**: se declara la más específica
  y el cuerpo verifica la otra con `ctx.has(...)` / `ctx.can(...)`. Ejemplo:
  `createMiembroAction` declara `crear_miembros` y en el cuerpo exige
  `ctx.can("registrar_pagos")` si `cobrar_inscripcion`.
- **Anónimas** (login, OTP, recuperar contraseña, cerrar sesión): agregar
  un propósito es editar la unión y aparece en el PR. `anonAction` se
  permite en cualquier carpeta.

### 4.2 Cómo se ve una acción

```ts
// app/(tenant)/[slug]/caja/actions.ts
export const registerPagoAction = panelAction(
  "caja.cobrar",
  { onDenied: (d) => ({ ok: false, error: d.error, fieldErrors: {} }) },
  async (ctx, _prev: PagoResult, formData: FormData): Promise<PagoResult> => {
    // ctx.id, ctx.plan, ctx.role, ctx.can(), ctx.has()
  }
);

// app/kiosco/[slug]/actions.ts — firma pública (slug, token, input)
export const crearCodigoCompraAction = kioscoAction(
  "kiosco.codigo_compra",
  { onDenied: (d) => ({ ok: false, error: d.error }) },
  async ({ gym, miembro, admin }, input: { items: ItemInput[]; metodo: KioscoMetodo }) => {
    // miembro viene del token: NO existe un miembroId que revalidar
  }
);

// app/portal/[slug]/clases/actions.ts — firma pública (slug, input)
export const reservarClasePortalAction = portalAction(
  "portal.reservar_clase",
  {},
  async ({ gym, session, admin }, input: { sesionId: string }) =>
    reservarConCupo(gym.id, input.sesionId, session.miembroId, admin)
);
```

En un archivo `"use server"` los exports deben ser funciones;
`export const x = panelAction(...)` cumple (mismo patrón que
next-safe-action).

### 4.3 Qué pasa cuando falla

- Nunca lanza: devuelve `{ ok: false, error, code }` con
  `code ∈ SIN_PLAN | SIN_PERMISO | SIN_SESION | IDENTIDAD_INVALIDA |
  GYM_NO_ENCONTRADO`.
- **`onDenied` es obligatorio por tipo** cuando la forma de retorno de la
  acción no absorbe ese objeto (`fieldErrors` requerido, `Nota[]`,
  `number`, `{ success }` del kiosco). Si la absorbe (`{ ok: boolean;
  error?: string }`), es opcional. Esto lo decide `OnDenied<R>` en
  `tipos.ts`, con `NoInfer` para que `R` salga solo del handler.
- Mensajes: `SIN_PLAN` → "Esta función requiere el plan Pro." (via
  `getRequiredPlan` + `PLAN_LABELS`); `SIN_PERMISO` → "No tienes permiso
  para cobrar." (via `PERMISSION_LABELS`).
- Log: una línea `console.warn` JSON con `tag: "authz.denied"`, clase,
  política, código, tenant, plan y rol. Greppable en Vercel. La UI ya
  oculta botones por rol/feature, así que si esto aparece es UI desalineada
  o alguien probando.
- Orden en panel: plan antes que rol (el dueño de un Starter ve "requiere
  Pro", no "no tienes permiso").

### 4.4 Qué garantiza contra la acción 152 (tres capas)

`tsc` no puede descubrir archivos por sí solo; solo comprueba lo que algo
importa. De ahí las tres capas:

1. **El tipo del constructor**: no compila sin política válida, ni una
   política sin ambos ejes (`satisfies` en `politicas.ts`), ni sin
   `onDenied` cuando hace falta.
2. **Registro generado + `satisfies`** — esto es lo que hace fallar a
   `tsc` y a `next build`. `scripts/authz-registry.mjs` recorre `app/**`
   buscando `"use server"`, agrupa por carpeta y escribe
   `lib/authz/__registry__.ts`:
   ```ts
   import * as m0 from "@/app/(tenant)/[slug]/caja/actions";
   export const panel = [m0] satisfies ReadonlyArray<Modulo<"panel">>;
   ```
   Como en `"use server"` todo export de valor es una función, un
   `export async function` sin envolver, o envuelto con el constructor de
   otra carpeta, rompe el `satisfies` (`lib/authz/tipos.typetest.ts` lo
   demuestra con `@ts-expect-error`). Corre en `prebuild`, `pretest` y
   `npm run typecheck`; el archivo se commitea y el test
   `registro.test.ts` exige que esté fresco.
3. **Regla ESLint `authz/wrapped-export`** (`error`): en archivos
   `"use server"` bajo `app/`, todo export debe ser `export const X =
   <constructor de la carpeta>(...)`. Da el error en el editor, en la
   línea. Next 16 ya no corre lint en `next build`: CI tiene que correr
   `npm run lint`.

Lo que **no** garantiza: que la política elegida sea la correcta. Eso es
revisión de código, y `politicas.ts` la hace revisable en un solo diff.

### 4.5 `legacy.json`

Lista de los módulos `"use server"` que aún no se migran. El generador y
la regla ESLint los omiten. Reglas: **solo puede encoger** (`LEGACY_MAX`
en `registro.test.ts` se baja en cada PR de migración, nunca se sube); un
módulo nuevo no puede entrar ahí sin que el diff lo grite; cuando llegue a
0 se borra la lista y su test.

## 5. Lo que el helper NO resuelve

| Problema | ¿Cubierto? | Qué lo cubre |
|---|---|---|
| El recurso pertenece al tenant (panel) | No | RLS con el client de sesión + queries que reciben `ctx.id`. |
| El recurso pertenece al socio (portal) | No | Convención: las queries del portal reciben `session.miembroId` de `ctx`, nunca del input. |
| `miembroId` ↔ `qr_token` (kiosco) | **Sí, estructural** | El handler recibe `ctx.miembro`; el parámetro `miembroId` desaparece de la firma. |
| `miembro_id` del body ↔ tenant (API v1) | No | Check inline en `/reservas`. `apiGuard` es otra pieza (ver §7). |
| Permisos condicionales | No | `ctx.can()` en el cuerpo, explícito. |
| Elegir bien la política | No | Revisión + paridad con el permiso que la UI usa para mostrar el botón. |
| Gates de página | PR 9 | `requirePanel("caja.cobrar")` leyendo el mismo `politicas.ts`. |

## 6. Plan de migración

Cada PR es mecánico y verificable con `tsc` + tests; el comportamiento
solo cambia donde hoy hay un hueco.

| PR | Alcance | Notas |
|---|---|---|
| **0** | `lib/authz/`, `politicas.ts` (caja y kiosco pobladas), generador, regla ESLint, `usar_panel`, `PERMISSION_LABELS`, proxy con request headers y borrado de entrantes, `getTenant` sin default. 53 módulos en `legacy.json`. | Entregado. Cero acciones migradas. |
| 1 | Kiosco: 7 acciones, 1 archivo, 3 componentes (`KioscoEntrada`, `KioscoComprar`, `KioscoMembresia`). | Entregado. Firma `(slug, token, ...args)`; el parámetro `miembroId` desapareció de 4 acciones. No cierra ninguna feature: `renovar_mp` pasa de `kiosco_autoservicio` a `mercadopago` (ambas Pro) y `actualizar_telefono` gana `qr_access` (Starter). |
| 2 | Portal: 8 acciones, 6 archivos. | Entregado. 5 → `portalAction`, 3 → `anonAction` (OTP ×2, cerrar sesión). Firmas públicas sin cambio. Sin sesión ya no hay `redirect` desde la acción: devuelve `SIN_SESION` ("Tu sesión expiró"). No cierra nada: `portal_miembro` es Escala y hereda `clases`/`mercadopago`/`opiniones`. |
| 3 | Admin: 19 acciones, 6 archivos. | Entregado. 17 → `adminAction`, 2 → `anonAction` (login, logout). Decisión nueva (2026-09-20): `super_admin` = facturación, existencia o acceso a la cuenta de un tenant (9: cancelar, suspender, cambiar plan, activar plan pagado, fundador, addon, reset password del owner, activar solicitud, pago manual); `admin` = soporte diario (8). `cerrarTodasSesionesAction` ya valida admin. Firmas sin cambio. |
| 4 | Panel `caja/` (4 archivos, 12 acciones). | Entregado. **Cierra** `creditos` (abono), `inventario` (solo líneas/concepto de producto, en el cuerpo con `has`+`can`; un ticket o cobro de membresía sigue siendo caja básica) y `kiosco_autoservicio` (autorizar/rechazar código). `vender_desde_caja` se **usa** (cuerpo de cobrar/ticket + la página oculta productos con el mismo par). Reporte (`sql/reportes/uso-features-pr4-caja.sql`, 2026-09-20): creditos 0 en todo el histórico; inventario 6 ventas (5 del 26-ago, 1 de prueba); kiosco 1 código de prueba. Cierres probados con plan mockeado en `caja/cierres.test.ts`. |
| 5 | Panel `miembros/` + `miembros/[id]/` (7 archivos, 21 acciones). | Entregado. **Cierra** `tags` (crear/editar con `tag_ids` en el cuerpo; bulk) y `bulk_actions` (ambas Pro); `creditos` y `nutricion` ya se exigían. Cambio de rol: importar CSV y regenerar QR pasan de `role === "owner"` a mano a `configurar_general` (owner + gerente, mismo criterio que `requireOwner`). Uso real (`sql/reportes/uso-features-pr5-miembros.sql`, 2026-09-20): **todo en cero** — tags, congelaciones, cambios de plan, importaciones, créditos, nutrición, en ambos tenants y en todo el histórico. Cierres probados con plan mockeado en `miembros/cierres.test.ts`. |
| 6 | Panel `configuracion/*` (13 archivos). | |
| 7 | Panel resto (14 archivos, incluye `suspendida` → `anonAction`). | |
| 8 | Auth → `anonAction`; `legacy.json` a 0 y borrado; `apiGuard` valida `hasFeature(plan, "api")`. | |
| **9** | `requirePanel(politica)` para `page.tsx`, leyendo el mismo `politicas.ts`. | El bug de `/caja` sin guard era exactamente esto: acción protegida, página no. |

**Protocolo para los PRs 4–7.** Al migrar el panel se cierran las 18
acciones que hoy verifican rol pero no plan. Eso **sí puede quitarle
funciones a un gimnasio** que las use sin tener el plan. Antes de cada
uno de esos PRs: (1) listar qué features empiezan a exigirse (las
entradas marcadas "cierra:" en `politicas.ts`), y (2) confirmar contra
`evolution-gym` y `gym-demo` que ninguno pierde algo que esté usando.
Regla para el permiso: el mismo que la UI usa para mostrar el botón, para
no quitarle nada a nadie por accidente.

## 7. Hallazgos colaterales (pendientes fuera de este diseño)

- `apiGuard` no valida `hasFeature(plan, "api")`: un gym que baje de plan
  sigue usando su API key. PR 8.
- `vender_desde_caja` existe como permiso pero ningún componente lo
  consulta; la venta de productos usa `registrar_pagos`. Se conserva así
  en `caja.vender_productos` para no cambiar comportamiento.
- Son 25 permisos (24 + `usar_panel`), no 23.
- **La distinción `admin`/`super_admin` vive solo en `adminAction`.**
  `string_admins.role` tiene default `'super_admin'` y `is_super_admin()`
  (la función de las RLS y los RPC) mira únicamente `activo`. Un admin de
  soporte con acceso a la consola de Supabase seguiría pudiendo todo.
  Cerrar (que `is_super_admin()` exija `role = 'super_admin'` donde toque)
  **antes de dar de alta a un segundo admin**; hoy hay uno solo.
- `requireOwner()` en `configuracion/cajas` y `configuracion/staff` no
  exige owner: pide `configurar_general` / `gestionar_staff`, que el
  gerente tiene por diseño ("owner menos planes y promociones"). Decisión:
  el mapa de permisos no se toca; en el PR 6 las políticas declaran esos
  permisos y el helper con nombre engañoso desaparece. Solo
  `toggleCajaCheckinPinAction` es owner-only, y lo es por la RLS de `gyms`
  (guard `ERROR_SOLO_OWNER`), no por el código.

## 8. Estado real de uso del producto (2026-09-20)

Los reportes de uso de los PRs 4 y 5 (`sql/reportes/`) dieron, para los
dos tenants vivos y en todo el histórico:

- **Ejercido de verdad**: alta de socios, cobro, check-in, y seis ventas de
  producto desde caja (cinco de `evolution-gym` el 26-ago-2026, una de
  prueba). `evolution-gym` opera desde julio con 45 socios y 53 pagos.
- **Cero absoluto**: créditos (planes de pago y cuotas), etiquetas,
  acciones masivas, congelaciones, cambios de plan, importación CSV,
  nutrición, códigos del kiosco de autoservicio (uno de prueba),
  MercadoPago.

La lista de "cinco rutas sin estrenar" (MercadoPago, WhatsApp, prueba de
14 días, alta desde el sitio, créditos) se queda corta: lo que hay es un
**producto cuyo núcleo está probado y cuya periferia entera no**. Todo lo
demás existe en código y nadie lo ha usado nunca, ni en demos.

Consecuencia para esta serie: **cada cierre de feature de los PRs 6 y 7
se prueba con plan mockeado contra la acción real** (como
`caja/cierres.test.ts` y `miembros/cierres.test.ts`), sin preguntar tenant
por tenant — ningún tenant lo va a haber ejercido. Consecuencia fuera de
esta serie: cualquier feature de la periferia que se venda en un plan se
vende sin que nadie la haya usado; créditos además con tres bugs
conocidos (crear plan a plazos no cobra la cuota 1, `pagarCuota` no es
atómico, el reembolso no desmarca la cuota).

## 9. Receta: agregar la acción 152

1. Elige la clase por la carpeta donde vive.
2. Agrega su política en `politicas.ts` (panel: feature **y** permission).
3. `export const miAction = panelAction("modulo.accion", { onDenied? }, async (ctx, ...args) => { ... })`.
4. `npm run typecheck` (regenera el registro) y `npm run lint`.
5. Si la acción es de página nueva, su `page.tsx` usa `requirePanel("modulo.accion")` (PR 9).

Si el editor marca el export en rojo, o `tsc` falla en
`lib/authz/__registry__.ts`, es el diseño funcionando.
