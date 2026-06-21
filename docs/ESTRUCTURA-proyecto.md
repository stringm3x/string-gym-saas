# Estructura del proyecto — STRING GYM SaaS

Mapa carpeta por carpeta y archivo por archivo. Sirve como referencia para
ubicar dónde está cada cosa (para ti o para un futuro dev).

---

## Stack y convenciones

- **Next.js 16 (App Router)** + TypeScript estricto (nada de `any`).
- **Supabase** (Postgres + Auth + Storage) con **RLS multitenant** por `tenant_id`.
- **Tailwind CSS** con variables CSS para colores (`app/globals.css`).
- **Zod v4** para validación (sintaxis `error:`).
- **Vitest** para tests unitarios.
- Patrón por capas: **página (Server Component) → server action → query (lib/queries) → Supabase**.
- Multitenancy: cada gym es un "tenant"; la URL lleva el `slug` del gym
  (`/[slug]/...`). El **middleware** resuelve el tenant + el rol y los inyecta
  como headers.

---

## Raíz del proyecto

| Archivo | Qué es |
|---------|--------|
| `middleware.ts` | **Portero del sistema.** Valida sesión, resuelve el gym por slug, resuelve el rol (owner/staff), inyecta headers `x-tenant-*` y `x-staff-role`. Define rutas públicas (`login`, `registro`, `auth`, `recibos`). |
| `next.config.ts` | Config de Next. Incluye `remotePatterns` para servir logos desde Supabase Storage con `next/image`. |
| `tailwind.config.js` | Colores del sistema mapeados a variables CSS (`bg`, `sidebar`, `canvas`, `brand-green`, etc.) y fuentes (Anton/Geist/Ubuntu Mono). |
| `postcss.config.js` | PostCSS (Tailwind). |
| `tsconfig.json` | Config TypeScript (alias `@/*`). |
| `package.json` | Dependencias y scripts (`dev`, `build`, `start`, `lint`, `test`). |
| `AGENTS.md` / `CLAUDE.md` | Instrucciones para asistentes de IA (CLAUDE.md incluye AGENTS.md). |
| `README.md` | Readme del repo. |
| `docs/` | Documentación (este archivo, funcionalidad por sección, resumen de sesión). |
| `sql/` | Migraciones SQL numeradas (se corren a mano en Supabase). |
| `public/` | Assets estáticos (ej. `plantilla-miembros.csv`). |

---

## `app/` — Rutas (App Router)

Los paréntesis `(grupo)` agrupan rutas **sin** agregar segmento a la URL.

### `app/(auth)/` — Autenticación
- `login/page.tsx` + `login/actions.tsx` — login. El action resuelve si el
  usuario es owner o staff activo y redirige según rol/plan.
- `layout.tsx` — layout centrado para pantallas de auth.

### `app/auth/` — Rutas públicas de auth (segmento literal "auth")
- `accept-invite/page.tsx` + `actions.ts` — el recepcionista invitado crea su
  contraseña aquí (ruta pública, sin login previo).

### `app/recibos/[token]/` — Recibo público
- `page.tsx` — recibo accesible por token único **sin login** (el link que va
  en el email). Usa el admin client para buscar el pago por `token_publico`.

### `app/(tenant)/[slug]/` — La app del gym (requiere sesión)
- `layout.tsx` — **layout principal.** Carga gym, badges, add-ons, marca y el
  staff actual; inyecta colores personalizados (Pro+); envuelve con
  `ToastProvider`, `StaffProvider`, `AddonsProvider`; arma Sidebar + Header + main.

Cada subcarpeta es una sección (cada una tiene `page.tsx` y, si crea/edita
datos, su `actions.ts`):

| Ruta | Sección |
|------|---------|
| `hoy/` | Pantalla "Hoy" (Pro+, owner) |
| `dashboard/` | Dashboard de métricas (owner) |
| `miembros/` | Lista de miembros |
| `miembros/[id]/` | Detalle de miembro |
| `miembros/nuevo/` | Alta de miembro (+ cobro inicial) |
| `miembros/importar/` | Wizard de importación CSV (owner) |
| `checkins/` | Check-in (kiosco + manual) |
| `caja/` | Cobros, visitas rápidas, historial |
| `inventario/` + `inventario/productos` + `inventario/movimientos` | Inventario (Pro+) |
| `prospectos/` | Kanban de prospectos (Pro+, owner) |
| `alertas/` | Centro de alertas (Escala, owner) |
| `recibos/[pagoId]/` | Recibo autenticado (+ anular pago) |
| `notas/actions.ts` | Acciones de notas (timeline polimórfico miembro/prospecto) |
| `configuracion/` | Layout de configuración (tabs) |
| `configuracion/gym` | Datos del gym (recibos) |
| `configuracion/marca` | Logo + colores |
| `configuracion/addons` | Catálogo de add-ons |
| `configuracion/staff` | Equipo / invitaciones (owner) |
| `configuracion/planes` | CRUD de planes |
| `configuracion/promociones` | CRUD de promociones |
| `configuracion/tags` | CRUD de tags (Pro+) |
| `configuracion/plantillas` | CRUD de plantillas de mensaje (Pro+) |

---

## `components/` — Componentes React

Organizados por dominio. Los de `ui/` son genéricos y reutilizables.

### `components/ui/` — Primitivos reutilizables
`Button`, `Input`, `Label`, `Badge`, `Modal`, `Toast`, `EmptyState`,
`TagSelector`, `ColorPicker`, `FileUpload`, `AccionesRapidas` (llamar/WhatsApp/
email), `FeatureGate` (bloqueo inline con CTA), `UpgradePage` (pantalla de
upgrade), `AccessDenied` (sin permiso por rol).

### `components/layout/`
`Sidebar` (nav + logo, filtra links por plan **y** permiso),
`SidebarWithActiveSection` (deriva la sección activa), `SidebarLink`, `Header`.

### `components/dashboard/`
`StatCard` (número con count-up + hover premium), `CheckinsChart` (gráfica de
barras CSS), `PorVencerList`.

### `components/miembros/`
`MiembrosToolbar` (filtros: estado/origen/tag/búsqueda), `MiembrosListClient`
(coordina selección), `MiembrosTable`, `BulkActionsBar`, `MiembroForm`,
`MiembroStatusBadge`, `CobroInscripcion`, `NotasTimeline` (Pro+) / `NotasLegacy`
(Básico), `MiembroArchivarButton` + `MiembroArchivadoBanner`.
- `import/` → `ImportarMiembrosWizard` (3 pasos), `CSVPreviewTable`, `ImportErrorsList`.

### `components/caja/`
`PagoForm` (cobro: plan/promo/custom, método, recibo, botón WhatsApp post-pago),
`VisitaRapidaButton` (modal de visita rápida), `PagosFeed` (movimientos del día),
`PagosHistory` (historial por miembro), `CajaFilters` (categorías),
`PlanPromoSelector`, `ProductoPromoSelector`.

### `components/checkins/`
`CheckinKiosk`, `CheckinsFeed`, `CheckinsHistory`, `ManualCheckinButton`.

### `components/recibos/`
`Recibo` (recibo imprimible compartido), `ReciboActions` (volver/imprimir
autenticado), `ReciboPrintButton` (imprimir público), `AnularPagoButton` (owner).

### `components/inventario/`
`InventarioTabs`, `ProductosManager`, `MovimientosList`.

### `components/prospectos/`
`ProspectosKanban`, `KanbanColumn`, `ProspectoCard`, `ProspectoModal`.

### `components/alertas/`
`AlertasList`, `AlertaCard`.

### `components/configuracion/`
`ConfigTabs` (tabs filtradas por plan/rol), y un *Manager* por sección:
`GymConfigManager`, `MarcaForm`/`MarcaFormClient`/`MarcaPreview`,
`AddonsManager`/`AddonCard`/`AddonDetailModal`, `StaffManager`/`StaffCard`/
`InviteStaffModal`, `PlanesManager`, `PromocionesManager`, `TagsManager`,
`PlantillasManager`.

---

## `lib/` — Lógica, datos y utilidades

### `lib/queries/` — Capa de datos (una por dominio)
Todas hablan con Supabase. Una por tabla/dominio: `miembros`, `pagos`,
`checkins`, `productos`, `planes`, `promociones`, `tags`, `plantillas`, `notas`,
`prospectos`, `dashboard`, `alertas`, `gyms`, `marca`, `addons`, `staff`.
> Patrón: funciones `listX/getX/createX/updateX/...`; reciben `tenantId`;
> devuelven `{ ok, ... }` o el dato. La RLS hace el aislamiento por tenant.

### `lib/validations/` — Schemas Zod (uno por dominio)
`miembro`, `pago`, `visita-rapida`, `plan-membresia`, `promocion`, `tag`,
`plantilla`, `producto`, `prospecto`, `gym`, `marca`, `import`, `staff`.

### `lib/supabase/` — Clientes de Supabase
- `server.ts` — client con sesión (cookies) para Server Components/actions.
- `client.ts` — client de browser.
- `admin.ts` — **service-role** (bypassa RLS). SOLO para Auth Admin API
  (invitaciones) y la lectura del recibo público por token.

### `lib/contexts/` — React Context (estado de sesión en cliente)
- `StaffContext.tsx` — rol + permisos (`useStaff`, `useCan`).
- `AddonsContext.tsx` — add-ons activos (`useHasAddon`).

### `lib/utils/` — Utilidades puras
`cn` (clases), `format` (moneda/fecha), `membresia-rango` (cálculo de
vencimiento + sus tests), `estado-membresia`, `plantilla` (compilar variables),
`csv-parser` (papaparse), `tokens` (token de recibo), `whatsapp` (mensaje de
pago), `whatsapp-soporte` (mensajes a soporte STRING).

### `lib/email/` — Envío de correo (Resend)
- `send-recibo.ts` — envía el recibo por email (no bloquea el pago).
- `templates/recibo.ts` — HTML del email con branding.

### `lib/integrations/`
- `whatsapp-automatico.ts` — hook **dormido** para Fase 7.5 (n8n + 360dialog).

### `lib/hooks/`
- `useCountUp.ts` — animación de conteo para los números del dashboard.

### `lib/` (raíz)
- `tenant.ts` — `getTenant()` lee los headers del middleware (`id`, `slug`,
  `plan`, `role`).
- `features.ts` — mapa de features por plan (básico/pro/escala) + `hasFeature`.
- `permissions.ts` — matriz de permisos por rol + `hasPermission`.
- `addons.ts` — catálogo de add-ons.
- `constants.ts` — constantes (ej. WhatsApp de soporte).
- `types/` — tipos compartidos (`staff.ts`, `import.ts`).

---

## `sql/` — Migraciones (correr a mano en Supabase, en orden)

| # | Qué agrega |
|---|-----------|
| `007` | Recibos: `folio` en pagos + datos del gym (tel/dir/RFC) |
| `008` | Archivar miembros (`archivado`, `archivado_at`) |
| `009` | Tabla `gym_addons` + RLS |
| `010` | Marca: logo/colores + bucket `gym-logos` + RLS de Storage |
| `011` | Tabla `staff` + RLS + trigger owner + backfill |
| `012` | Policy de auto-lectura del propio staff |
| `013` / `013b` | `user_gym_ids()` (owner ∪ staff activo) + lectura de gyms por staff |
| `014` | RLS de todas las tablas de negocio basada en `user_gym_ids()` |
| `015` | Importación: `origen_importacion` + `plan_id` en miembros |
| `016` | Visitas rápidas (campos del visitante en pagos) |
| `017` | `token_publico` en pagos (recibo público) |
| `018` | Anular pago (`anulado_at`) |
| `019` | Color de fondo personalizable (`color_fondo` en gyms) |

> Nota: el esquema inicial (tablas base: gyms, miembros, pagos, etc.) se creó
> en Supabase antes de la `007`, así que esas tablas no tienen archivo en `sql/`.

---

## Flujo de una petición típica (ej. cobrar un pago)

1. El usuario entra a `/[slug]/caja` → **middleware** valida sesión, resuelve
   gym + rol, inyecta headers.
2. `caja/page.tsx` (Server Component) usa `getTenant()` + queries para cargar datos.
3. El usuario envía el form de `PagoForm` → llama a `registerPagoAction`
   (`caja/actions.ts`).
4. El action valida con Zod, verifica permiso (`hasPermission`), llama a
   `createPago` (`lib/queries/pagos.queries.ts`).
5. La query inserta en Supabase; la **RLS** garantiza que solo toca datos del
   gym correcto. Si hay email, dispara `sendRecibo`.
6. `revalidatePath` refresca la pantalla.

Este patrón (página → action → query → Supabase, con gate doble cliente+
servidor) se repite en todo el sistema.
