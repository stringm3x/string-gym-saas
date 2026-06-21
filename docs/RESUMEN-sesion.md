# Resumen de sesión — STRING GYM SaaS

Cubre desde el cierre de **Fase 6.5** hasta el **Polish pre-Fase 7**.
Todo con `npm run build` limpio y (donde aplica) tests pasando.

---

## 1. Fase 6.5 — CRM avanzado (cierre)

| Bloque | Qué se construyó |
|--------|------------------|
| **B4** Plantillas | CRUD de plantillas de mensaje con variables (`{{nombre}}`, `{{fecha_vencimiento}}`, `{{gym_nombre}}`), inserción al cursor, seed de 4 defaults |
| **B5** Selección múltiple | `MiembrosListClient` + `BulkActionsBar`: WhatsApp masivo, asignar tag, exportar CSV; checkboxes en la tabla |
| **B6** Pantalla "Hoy" | `/[slug]/hoy` (stats del día + alertas); sidebar con "Hoy"; root redirige a `/hoy` |
| **B7** Recibos | Recibo imprimible (`/recibos/[pagoId]`), `folio` por gym, `GymConfigManager` (tel/dirección/RFC), Toast con CTA "Ver recibo" |
| **B9** Archivar miembros | Soft delete (`archivado`/`archivado_at`), excluido de stats/alertas/búsquedas; banner + restaurar |
| **B10** Cobrar al inscribir | `CobroInscripcion` en el alta; `createMiembroAction` pasa de redirect a retornar `{miembroId, pagoId}` |
| **B8** FeatureGates | `lib/features.ts` reparto final básico/pro/escala con herencia; `UpgradePage`; gating de sidebar/tabs/páginas/acciones por plan |

**SQL:** `007_recibos`, `008_archivar_miembros`.

---

## 2. Fase 6.6 — Infraestructura de Add-ons
- `lib/addons.ts` (catálogo de 7 add-ons), `addons.queries`, `AddonsContext`, helpers de WhatsApp soporte.
- Página `/configuracion/addons` (Activos / Disponibles / Próximamente) + modal de detalle.
- **SQL:** `009_gym_addons` (tabla + RLS).
- No hay add-ons funcionales aún — solo la infraestructura para activarlos/listarlos.

---

## 3. Fase 6.7 — Personalización de marca
- **Logo** del gym (todos los planes) en sidebar, recibos y kiosco; subida a **Supabase Storage** (bucket `gym-logos`).
- **Colores** (Pro+): acento + sidebar, con preview en vivo; inyectados como variables CSS solo para Pro+.
- `FileUpload`, `ColorPicker`, `MarcaForm/Client/Preview`, página `/configuracion/marca`.
- **SQL:** `010_marca_personalizada` (columnas + bucket + RLS).
- **Config:** `next.config.ts` con `remotePatterns` para servir logos vía `next/image`.
- Decisión: variable nueva `--color-sidebar` (default `#0a0a0a`, no cambia el look actual).

---

## 4. Fase 6.8 — Multiusuario con roles Staff (la más grande)
- **Roles** `owner` / `receptionist` con matriz de permisos (`lib/permissions.ts`), `StaffContext`, `lib/types/staff.ts`.
- `getTenant()` ahora expone `role` (inyectado por el middleware vía header `x-staff-role`).
- **Middleware reescrito:** permite owner **o** staff activo (antes era owner-only).
- Gestión de staff: `/configuracion/staff`, invitaciones por email (Supabase Admin API), aceptar invitación en **`/auth/accept-invite`** (ruta pública), estados invitado/activo/desactivado.
- **Permisos aplicados** en sidebar, redirects de páginas, `AccessDenied`, y **gates server-side en todos los actions** (defensa anti-curl).
- **Fix de login multiusuario** + robustez del accept-invite (signOut de sesión previa, flujo implícito por hash, diagnóstico de casos).
- **RLS:** se cambió de "owner del gym" a "**staff activo**" en todas las tablas de negocio, vía función `user_gym_ids()` (owner ∪ staff activo, `SECURITY DEFINER` para evitar recursión).
- **SQL:** `011_staff_multiusuario`, `012_staff_self_read`, `013_gyms_staff_read`, `013b_user_gym_ids_union`, `014_business_tables_staff_access`.
- **Env:** `SUPABASE_SERVICE_ROLE_KEY` (Admin API de invitaciones); `lib/supabase/admin.ts`.
- **Decisión clave:** service-role quedó aislado **solo** para la Admin API; las lecturas de rol usan el client de sesión con la policy de auto-lectura.

---

## 5. Fase 6.9 — Importación CSV de miembros
- Wizard de 3 pasos (`/miembros/importar`, owner-only): subir → preview (válidos/errores/duplicados/planes) → resultado.
- Parser (`papaparse`), validación Zod, detección de duplicados (en CSV y BD, normalizados), mapeo de planes, importación por chunks de 50 con tolerancia a fallos, `origen_importacion` único.
- Filtro de origen (manual / CSV) en la lista; plantilla descargable `public/plantilla-miembros.csv`.
- **SQL:** `015_origen_importacion` (`origen_importacion` + `plan_id`).
- **Dep:** `papaparse` + `@types/papaparse`.

---

## 6. Polish pre-Fase 7

### Bloque 1 — Bugs
- `fix(dashboard)`: gráfica de check-ins no renderizaba (columnas sin altura).
- `refactor(miembros)`: filtros duplicados → control de Estado único (Archivados incluido).
- `style(caja)`: separar "Registrar cobro" de "Cobrado hoy".

### Bloque 2 — Lógica de negocio
- `feat(pagos)`: **día de pago original** en renovaciones (suma de días; umbral 30 días = reactivación) + **Vitest** con 12 tests.
- `feat(caja)`: **visita rápida** (cobro sin registrar miembro) + card "Visitas hoy". **SQL `016`**.
- `style(caja)`: panel "Personalizar precio/duración" **colapsado** por defecto.
- `feat(recibos)`: **email automático** (Resend) con **link a recibo público** `/recibos/[token]` (sin login), branding del gym; **anular pago** (owner; no cuenta en totales; recibo invalidado); **botón WhatsApp** tras el cobro (Capa 2); **hook automático dormido** para Fase 7.5 (Capa 3). **SQL `017`, `018`**.

### Bloque 3 — UX/UI
- `style(dashboard)`: premium con CSS (gradientes, hover lift+glow, badges de icono, entrada en stagger) — sin agregar framer-motion.
- `feat(marca)`: **color de fondo del contenido** personalizable (Pro+). **SQL `019`**.

### Bloque 4 — Docs
- `docs/funcionalidad-por-seccion.md` (15 secciones).

### Bloque 5 — Audit manual (lo corre Carlos)
Checklist: Staff (invitar/aceptar/login/desactivar), Planes (CRUD), Promociones (CRUD + uso en caja), Plantillas (CRUD + uso en WhatsApp).

---

## Estado y pendientes

**SQL:** migraciones `007`–`019` **todas corridas en Supabase** ✅.

**Variables de entorno:**
- `SUPABASE_SERVICE_ROLE_KEY` — local + Vercel (staff invites).
- `RESEND_API_KEY` — local ✅; **confirmar/agregar en Vercel** para email en producción.
- `N8N_WHATSAPP_WEBHOOK_URL` — solo Fase 7.5 (hoy el hook está dormido, no-op).

**Dependencias nuevas:** `papaparse`, `@types/papaparse`, `resend`, `vitest`.

**Scripts nuevos:** `npm test` (Vitest — tests de `lib/utils/membresia-rango`).

**Git:** `main` adelantada de `origin/main` (Fase 6.9 commit 4 + todo el polish) — pendiente `git push`.

**Hallazgos del plan que NO se cumplían (resueltos):** Resend no estaba configurado; framer-motion no instalado; `MiembrosHeader/MiembrosFilters` no existían — se adaptó a la realidad del código.

---

## Decisiones de arquitectura tomadas en la sesión
1. **Service-role aislado:** solo para Auth Admin API (invitaciones); lecturas de rol con client de sesión + policy de auto-lectura (`012`).
2. **`user_gym_ids()` SECURITY DEFINER** (owner ∪ staff activo) como base de la RLS multiusuario, evitando recursión gyms↔staff.
3. **Día de pago por días** (no meses calendario), porque el modelo guarda `dias_duracion`; umbral de reactivación = 30 días.
4. **Recibo público por token** (Opción B, sin PDF): link HTML con acceso por `token_publico`, lookup con admin client.
5. **Capa 3 WhatsApp dormida:** hook que solo actúa si `N8N_WHATSAPP_WEBHOOK_URL` existe; hoy no-op total (sin tocar el flujo del pago).
6. **Color de fondo** vía variable nueva `--color-bg-content` (`bg-canvas`), aplicada solo al área de contenido y solo para Pro+.
