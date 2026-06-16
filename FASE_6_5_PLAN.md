# Fase 6.5 — Seguimiento y Comunicación

> Plan de implementación para Claude Code. Lee este documento completo
> antes de empezar y pregunta cualquier cosa que no quede clara.

---

## Contexto del proyecto

STRING GYM SaaS — CRM multitenant para gimnasios. Continuación de Fase 6.

Convenciones ya establecidas (mantén el patrón):
- Next.js 14 App Router + TypeScript estricto (nunca `any`)
- Tailwind v3.4 con variables CSS (text-text-primary, bg-surface, brand-green, etc.)
- Supabase con RLS multitenant por `tenant_id`
- Zod v4 (usa `error:` NO `invalid_type_error:`)
- Server Actions en `app/(tenant)/[slug]/<modulo>/actions.ts`
- Queries en `lib/queries/<modulo>.queries.ts`
- Validaciones en `lib/validations/<modulo>.schema.ts`
- Componentes UI base en `components/ui/`, módulos en `components/<modulo>/`
- Páginas usan `getTenant()` de `@/lib/tenant`
- Toasts con `useToast()` de `@/components/ui/Toast`
- Modales con `<Modal>` de `@/components/ui/Modal`

---

## ALCANCE DE FASE 6.5 (decisiones tomadas)

1. **Tags predefinidos** (CRUD en configuración, asignación inline a miembros/prospectos)
2. **Timeline de notas** con historia (reemplaza campo notas plano)
3. **Acciones rápidas** en detalle de miembro y prospecto (Llamar, WhatsApp, Marcar contactado)
4. **Plantillas de mensaje WhatsApp** con variables (CRUD en configuración)
5. **Selección múltiple en miembros** con 3 acciones masivas (WhatsApp bulk, asignar tag, exportar CSV)
6. **Pantalla "Hoy"** como entrada principal del sistema (arriba de Dashboard en sidebar)

NO se incluye:
- Envío automático de WhatsApp (queda para integración n8n + 360dialog)
- Email / SMS (solo WhatsApp en esta fase)
- Chatbots (queda como add-ons futuros)

---

## MIGRACIÓN DE BASE DE DATOS (correr ANTES de empezar el código)

Antes de tocar TypeScript, ejecutar este SQL en Supabase:

```sql
-- ============================================
-- TABLA: tags (catálogo predefinido por gym)
-- ============================================
create table tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references gyms(id) not null,
  nombre text not null,
  color text not null default 'neutral' check (color in (
    'success', 'warning', 'danger', 'info', 'neutral', 'gold'
  )),
  created_at timestamptz default now(),
  unique(tenant_id, nombre)
);

create index idx_tags_tenant on tags(tenant_id);

-- ============================================
-- TABLA: miembros_tags (relación N:N)
-- ============================================
create table miembros_tags (
  miembro_id uuid references miembros(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  tenant_id uuid references gyms(id) not null,
  primary key (miembro_id, tag_id)
);

create index idx_miembros_tags_miembro on miembros_tags(miembro_id);
create index idx_miembros_tags_tag on miembros_tags(tag_id);

-- ============================================
-- TABLA: prospectos_tags (relación N:N)
-- ============================================
create table prospectos_tags (
  prospecto_id uuid references prospectos(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  tenant_id uuid references gyms(id) not null,
  primary key (prospecto_id, tag_id)
);

create index idx_prospectos_tags_prospecto on prospectos_tags(prospecto_id);
create index idx_prospectos_tags_tag on prospectos_tags(tag_id);

-- ============================================
-- TABLA: notas (timeline polimórfico)
-- ============================================
create table notas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references gyms(id) not null,
  entidad_tipo text not null check (entidad_tipo in ('miembro', 'prospecto')),
  entidad_id uuid not null,
  contenido text not null,
  /** Tipo opcional de acción que el operador anotó */
  tipo_accion text check (tipo_accion in (
    'llamada', 'whatsapp', 'visita', 'email', 'otro'
  )),
  created_at timestamptz default now()
);

create index idx_notas_tenant on notas(tenant_id);
create index idx_notas_entidad on notas(tenant_id, entidad_tipo, entidad_id);
create index idx_notas_fecha on notas(tenant_id, created_at);

-- ============================================
-- TABLA: plantillas_mensaje (WhatsApp templates por gym)
-- ============================================
create table plantillas_mensaje (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references gyms(id) not null,
  nombre text not null,
  /** Para qué tipo de destinatario aplica (filtra el selector) */
  categoria text not null check (categoria in (
    'miembro_activo', 'miembro_por_vencer', 'miembro_vencido',
    'prospecto', 'general'
  )),
  contenido text not null,
  activo boolean not null default true,
  created_at timestamptz default now()
);

create index idx_plantillas_tenant on plantillas_mensaje(tenant_id);
create index idx_plantillas_activo on plantillas_mensaje(tenant_id, activo);

-- ============================================
-- RLS
-- ============================================
alter table tags enable row level security;
alter table miembros_tags enable row level security;
alter table prospectos_tags enable row level security;
alter table notas enable row level security;
alter table plantillas_mensaje enable row level security;

create policy "tenant_isolation_tags" on tags
  for all using (tenant_id in (select id from gyms where owner_id = auth.uid()));

create policy "tenant_isolation_miembros_tags" on miembros_tags
  for all using (tenant_id in (select id from gyms where owner_id = auth.uid()));

create policy "tenant_isolation_prospectos_tags" on prospectos_tags
  for all using (tenant_id in (select id from gyms where owner_id = auth.uid()));

create policy "tenant_isolation_notas" on notas
  for all using (tenant_id in (select id from gyms where owner_id = auth.uid()));

create policy "tenant_isolation_plantillas" on plantillas_mensaje
  for all using (tenant_id in (select id from gyms where owner_id = auth.uid()));
```

---

## BLOQUE 1 — Tags (catálogo + asignación)

### Schema y queries

`lib/validations/tag.schema.ts`:
- `tagSchema`: nombre (string trim, min 2, max 30), color (enum de los 6 colores del CHECK)

`lib/queries/tags.queries.ts`:
- `listTags(tenantId)` — todos los tags del gym
- `createTag(tenantId, input)`
- `updateTag(tenantId, id, input)`
- `deleteTag(tenantId, id)` — soft solo si no se usa, o hard delete con cascade (decisión: hard delete, las relaciones tienen `on delete cascade`)
- `assignTagToMiembro(tenantId, miembroId, tagId)` y `removeTagFromMiembro(...)`
- `assignTagToProspecto(tenantId, prospectoId, tagId)` y `removeTagFromProspecto(...)`
- `getTagsForMiembro(tenantId, miembroId)` — devuelve array de tags
- `getTagsForProspecto(tenantId, prospectoId)`
- Extender `listMiembros` para incluir un array `tags?: Tag[]` por cada miembro (LEFT JOIN o query agregada)
- Agregar filtro `tagId?` opcional a `listMiembros` para filtrar por tag

### UI

`components/configuracion/TagsManager.tsx` (en sub-tab Tags de configuración):
- Lista de tags con su color (preview como Badge)
- Botón "Nuevo tag" abre modal con: nombre + selector de color (6 swatches clickeables)
- Edición inline o por modal
- Botón eliminar (con confirmación, advierte si está en uso por X miembros/prospectos)

Agregar tab "Tags" a `components/configuracion/ConfigTabs.tsx`.

`components/ui/TagSelector.tsx` (componente reutilizable):
- Recibe `tags: Tag[]` disponibles y `selectedIds: string[]`
- Renderiza chips con check si están seleccionados
- onChange dispara la lista actualizada

### Integración

**En `MiembroForm.tsx`:**
- Agregar selector de tags (debajo del campo notas o como sección aparte)
- En modo edición, cargar tags actuales del miembro
- En `createMiembroAction` y `updateMiembroAction`: después de crear/actualizar el miembro, sincronizar tags (delete + insert)

**En lista de miembros (`MiembrosTable.tsx`):**
- Agregar columna "Tags" mostrando los badges (max 3, "+N más" si hay más)
- En `MiembrosToolbar.tsx`: agregar filtro adicional por tag (dropdown)

**En Kanban de prospectos:**
- `ProspectoCard.tsx`: mostrar tags como pequeños badges debajo del nombre
- `ProspectoModal.tsx`: incluir TagSelector

---

## BLOQUE 2 — Timeline de notas

### Schema y queries

`lib/validations/nota.schema.ts`:
- `notaSchema`: contenido (string min 1 max 1000), tipo_accion (enum opcional)

`lib/queries/notas.queries.ts`:
- `listNotas(tenantId, entidadTipo, entidadId)` — ordenadas desc por created_at
- `createNota(tenantId, entidadTipo, entidadId, input)`
- `deleteNota(tenantId, id)` — solo permite borrar al creador (en futuro con multi-usuario)

### UI

`components/notas/NotasTimeline.tsx`:
- Lista vertical con línea conectora a la izquierda
- Cada nota: ícono según `tipo_accion`, contenido, "Hace X días" relativo
- Input rápido arriba para agregar nota: textarea + selector de tipo + botón "Agregar"
- Sin paginación por ahora (assumes max ~50 notas por miembro)

Componente reutilizable:
```typescript
<NotasTimeline
  entidadTipo="miembro" | "prospecto"
  entidadId={id}
/>
```

### Integración

**En detalle de miembro:**
- Reemplazar el campo `notas` plano por `<NotasTimeline entidadTipo="miembro" entidadId={miembro.id} />`
- El campo notas viejo en la tabla queda como "nota legacy", se muestra arriba del timeline si tiene contenido

**En `ProspectoModal.tsx`:**
- En modo edición, agregar `<NotasTimeline entidadTipo="prospecto" entidadId={prospecto.id} />` debajo del form

---

## BLOQUE 3 — Acciones rápidas

### Componente

`components/ui/AccionesRapidas.tsx`:

```typescript
interface AccionesRapidasProps {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  /** Para registrar nota automática al usar la acción */
  entidadTipo: 'miembro' | 'prospecto';
  entidadId: string;
  /** Plantillas de mensaje categorizadas para seleccionar */
  plantillas?: PlantillaMensaje[];
}
```

Renderiza una fila de botones:
- **Llamar** (`LuPhone`): si hay telefono → abre `tel:{telefono}` y registra nota automática "Llamada iniciada"
- **WhatsApp** (`LuMessageCircle`): si hay telefono → abre modal de selección de plantilla → al elegir, abre `wa.me/{telefono}?text={mensaje_compilado}` y registra nota "WhatsApp enviado: {nombre_plantilla}"
- **Email** (`LuMail`): SOLO si hay email → abre `mailto:{email}` (sin plantilla, simple por ahora)
- **Marcar contactado** (`LuCheck`): registra nota "Contacto marcado" sin acción externa

El botón de WhatsApp abre un mini-modal interno con:
- Lista de plantillas filtradas según contexto (categoria)
- Click en plantilla → compila variables → abre WhatsApp Web

### Compilación de variables en plantillas

Las plantillas tienen variables tipo `{{nombre}}`, `{{fecha_vencimiento}}`, `{{gym_nombre}}`.

`lib/utils/plantilla.ts`:
```typescript
export function compilarPlantilla(
  contenido: string,
  context: { nombre?: string; fecha_vencimiento?: string; gym_nombre?: string }
): string {
  return contenido.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return String(context[key as keyof typeof context] ?? `{{${key}}}`);
  });
}
```

### Server Action

`app/(tenant)/[slug]/notas/actions.ts`:
- `createNotaAction(entidadTipo, entidadId, contenido, tipoAccion)` — server action ligera para registrar notas desde el componente cliente AccionesRapidas

### Integración

Agregar `<AccionesRapidas />` en:
- Detalle de miembro (`app/(tenant)/[slug]/miembros/[id]/page.tsx`) — junto al botón de check-in
- `ProspectoModal.tsx` en modo edición — arriba del timeline

---

## BLOQUE 4 — Plantillas de mensaje

### Schema y queries

`lib/validations/plantilla.schema.ts`:
- `plantillaSchema`: nombre (string min 2 max 80), categoria (enum), contenido (string min 5 max 1000), activo (boolean)

`lib/queries/plantillas.queries.ts`:
- `listPlantillas(tenantId, options?: { categoria?, soloActivas? })`
- CRUD estándar

### UI

`components/configuracion/PlantillasManager.tsx` (sub-tab Plantillas en configuración):
- Lista con nombre, categoría, preview de contenido (primeras 80 chars)
- Modal con: nombre, categoría, textarea grande para contenido
- Panel de ayuda lateral con variables disponibles: `{{nombre}}`, `{{fecha_vencimiento}}`, `{{gym_nombre}}` — click en cada una la inserta en el textarea
- Toggle activo/inactivo

Agregar tab "Plantillas" en `ConfigTabs.tsx`.

### Seed de plantillas iniciales

Al cargar la página vacía, sugerir botón "Crear plantillas sugeridas" que crea 4 plantillas comunes:
1. "Recordatorio vencimiento" (categoría: miembro_por_vencer) — "Hola {{nombre}}, tu membresía en {{gym_nombre}} vence el {{fecha_vencimiento}}. Te esperamos para renovar."
2. "Te extrañamos" (categoría: miembro_vencido) — "Hola {{nombre}}, hace tiempo no te vemos en {{gym_nombre}}. ¿Volvemos a verte esta semana?"
3. "Bienvenida prospecto" (categoría: prospecto) — "Hola {{nombre}}, gracias por interesarte en {{gym_nombre}}. ¿Te agendamos tu clase de prueba?"
4. "Promo del mes" (categoría: general) — "Hola {{nombre}}, este mes tenemos promociones especiales en {{gym_nombre}}. ¿Te platico?"

---

## BLOQUE 5 — Selección múltiple en miembros

### Lista con checkboxes

Modificar `MiembrosTable.tsx`:
- Agregar columna checkbox a la izquierda
- Checkbox en header selecciona todos los visibles
- Estado de selección en `MiembrosToolbar` o en page (con searchParams si se quiere persistir entre navegación; recomiendo localState para simplicidad)

### Barra de acciones masivas

`components/miembros/BulkActionsBar.tsx`:
- Aparece flotante abajo cuando hay selección (animación slide-up)
- Muestra "X miembros seleccionados" + botón "Deseleccionar"
- 3 botones de acción:
  - **WhatsApp masivo** (`LuMessageCircle`): abre modal de selección de plantilla, luego:
    - Abre `wa.me/{primer_telefono}?text=...` en ventana nueva
    - Copia al portapapeles la lista completa de teléfonos con sus mensajes compilados
    - Toast: "Mensaje 1 de N abierto. Resto copiado al portapapeles."
  - **Asignar tag** (`LuTag`): modal con TagSelector, asigna el tag a todos los seleccionados
  - **Exportar CSV** (`LuDownload`): descarga CSV con nombre, telefono, email, fecha_vencimiento, estado, tags

### Server Actions

`app/(tenant)/[slug]/miembros/actions.ts` (agregar):
- `bulkAsignarTagAction(miembroIds: string[], tagId: string)`
- `bulkExportarAction(miembroIds: string[])` — devuelve string CSV (el cliente hace el download con Blob)

El WhatsApp masivo no necesita action — todo se hace en cliente.

---

## BLOQUE 6 — Pantalla "Hoy"

### Concepto

Página principal después del login, reemplaza el redirect actual `/` → `/dashboard` con `/` → `/hoy`.

Lista accionable de TODO lo pendiente del día:

```
┌──────────────────────────────────────────┐
│ Hoy, lunes 15 de junio                   │
│ Bienvenido de vuelta, {Gym Nombre}       │
├──────────────────────────────────────────┤
│ 🔴 URGENTE                                │
│ • 3 miembros vencen HOY            [Ver] │
│ • 2 productos sin stock            [Ver] │
├──────────────────────────────────────────┤
│ 🟡 ATENCIÓN                               │
│ • 5 prospectos nuevos sin contactar [Ver]│
│ • 8 miembros vencen esta semana    [Ver] │
├──────────────────────────────────────────┤
│ 💡 OPORTUNIDADES                          │
│ • 12 miembros inactivos 14d+       [Ver] │
│ • Promo activa: "2x1 Septiembre"   [Ver] │
├──────────────────────────────────────────┤
│ 📊 RESUMEN DE HOY                         │
│ Check-ins: 8 | Ingresos: $2,400 | Nuevos: 1│
└──────────────────────────────────────────┘
```

### Queries y página

Reutilizar `getAlertas()` que ya existe y agruparlas por severidad en la página.

Agregar al getter:
- Resumen de hoy (check-ins, ingresos, miembros nuevos) — reutilizar queries existentes

`app/(tenant)/[slug]/hoy/page.tsx`:
- Saludo personalizado con nombre del gym y fecha en español
- Secciones por severidad (Urgente, Atención, Oportunidades)
- Cards con count grande + descripción + botón "Ver"
- Resumen del día abajo (3 stats horizontales)

### Sidebar y routing

- Agregar link "Hoy" en sidebar ARRIBA de Dashboard, con ícono `LuSunrise`
- Activo si pathname comienza con `/hoy`
- Cambiar redirect en `app/page.tsx`: si hay sesión y tenant, redirigir a `/[slug]/hoy` en vez de `/[slug]/dashboard`
- IMPORTANTE: la pantalla "Hoy" está disponible para TODOS los planes (no es feature de Escala) — la diferencia con Alertas (que sí es plan Escala) es que Hoy agrega resumen de día y bienvenida, mientras Alertas es solo la lista cruda

---

## ENTREGABLES ESPERADOS

### Archivos NUEVOS

```
sql/005_seguimiento.sql (las 5 migraciones SQL en un archivo)

lib/validations/
  tag.schema.ts
  nota.schema.ts
  plantilla.schema.ts

lib/queries/
  tags.queries.ts
  notas.queries.ts
  plantillas.queries.ts

lib/utils/
  plantilla.ts (compilarPlantilla)

components/ui/
  TagSelector.tsx
  AccionesRapidas.tsx

components/configuracion/
  TagsManager.tsx
  PlantillasManager.tsx

components/notas/
  NotasTimeline.tsx

components/miembros/
  BulkActionsBar.tsx

app/(tenant)/[slug]/
  hoy/page.tsx
  configuracion/tags/page.tsx
  configuracion/plantillas/page.tsx
  notas/actions.ts
```

### Archivos MODIFICADOS

```
app/page.tsx — redirect a /hoy en vez de /dashboard

components/configuracion/ConfigTabs.tsx — agregar tabs Tags + Plantillas
components/layout/Sidebar.tsx — link "Hoy" arriba de Dashboard, ícono LuSunrise
components/layout/SidebarLink.tsx (si hace falta)

lib/queries/miembros.queries.ts:
  - Extender listMiembros con tags
  - Agregar filtro por tagId

components/miembros/MiembrosTable.tsx — columna checkbox + columna tags
components/miembros/MiembrosToolbar.tsx — filtro por tag + manejo de selección
components/miembros/MiembroForm.tsx — TagSelector

app/(tenant)/[slug]/miembros/[id]/page.tsx — AccionesRapidas + NotasTimeline
app/(tenant)/[slug]/miembros/actions.ts:
  - bulkAsignarTagAction
  - bulkExportarAction
  - actualizar createMiembroAction y updateMiembroAction para sincronizar tags

components/prospectos/ProspectoCard.tsx — mostrar tags
components/prospectos/ProspectoModal.tsx — TagSelector + NotasTimeline + AccionesRapidas
app/(tenant)/[slug]/prospectos/actions.ts — sincronizar tags
```

---

## CRITERIOS DE ACEPTACIÓN

1. SQL ejecutado en Supabase sin errores
2. Crear tag "VIP" en /configuracion/tags con color gold
3. Asignar tag a 2 miembros — debe aparecer en su detalle Y en la tabla
4. Filtrar miembros por tag "VIP" — debe mostrar solo esos 2
5. Crear nota tipo "llamada" en un miembro — aparece en su timeline
6. Click en botón "Llamar" en detalle de miembro — abre el dialer del SO (en desktop, abre Skype/FaceTime)
7. Click en botón "WhatsApp" → seleccionar plantilla → debe abrir wa.me con texto compilado (verifica que {{nombre}} se reemplazó)
8. Crear plantilla en /configuracion/plantillas usando los botones de inserción de variables
9. Seleccionar 3 miembros en lista, asignar tag masivamente — los 3 lo reciben
10. Exportar 3 miembros a CSV — descarga el archivo correctamente
11. Visitar / → redirige a /[slug]/hoy
12. Pantalla "Hoy" muestra secciones agrupadas con counts reales
13. Link "Hoy" aparece arriba de Dashboard en sidebar
14. Build pasa sin errores de TypeScript

---

## PREGUNTAS QUE HAGAS ANTES DE EMPEZAR

Si algo no queda claro, pregunta antes de implementar. En particular:
- Si hay conflicto con código existente que no esperabas
- Si una decisión de UX te parece subóptima — propón alternativa
- Si encuentras que algún campo de DB está mal nombrado o sobra

---

## BLOQUE 7 — Recibos de pago

### Concepto

Recibos HTML imprimibles, generados al vuelo desde los datos del pago.
No se persiste el PDF — se genera con `window.print()` y CSS print.
Diseño limpio, branding del gym arriba, descargable como PDF desde el
diálogo de impresión del navegador.

### Schema SQL (correr en Supabase ANTES)

```sql
-- Folio consecutivo por gym
alter table pagos add column folio integer;

-- Trigger que asigna folio al insertar
create or replace function asignar_folio_pago()
returns trigger as $$
begin
  select coalesce(max(folio), 0) + 1 into new.folio
  from pagos
  where tenant_id = new.tenant_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_folio_pago
  before insert on pagos
  for each row
  when (new.folio is null)
  execute function asignar_folio_pago();

-- Datos de identidad del gym para recibos
alter table gyms add column telefono text;
alter table gyms add column direccion text;
alter table gyms add column rfc text;

-- Backfill: asignar folio a pagos existentes (orden por fecha)
update pagos p1
set folio = sub.rn
from (
  select id, row_number() over (
    partition by tenant_id
    order by fecha_pago asc
  ) as rn
  from pagos
) sub
where p1.id = sub.id;
```

### Queries

`lib/queries/pagos.queries.ts` (extender):
- `getPagoCompleto(tenantId, pagoId)` — devuelve pago con joins:
  - miembro (nombre, telefono)
  - producto (nombre)
  - plan (nombre, dias_duracion)
  - promocion (nombre)
  - gym (nombre, logo_url, telefono, direccion, rfc)

Tipo `PagoCompleto` con todos esos campos embebidos.

### UI

`components/recibos/Recibo.tsx`:
- Componente que renderiza el recibo
- Recibe `PagoCompleto` como prop
- CSS print con `@media print` para esconder elementos no imprimibles
- Layout: header con logo + nombre gym, body con detalles, footer con datos fiscales/contacto
- Tipografía: usar font-display (Anton) para el monto grande, font-sans (Geist) para el resto
- Color: minimal en print (negro sobre blanco), en pantalla puede mantener el dark mode con un toggle

`app/(tenant)/[slug]/recibos/[pagoId]/page.tsx`:
- Página dedicada al recibo (URL compartible)
- Botones flotantes (que se esconden en print):
  - "Imprimir / Guardar PDF" → `window.print()`
  - "Compartir WhatsApp" → `wa.me/{telefono_miembro}?text=Recibo de pago: {url_recibo}`
  - "Volver" → `/[slug]/caja`

### Integración

**En `PagoForm.tsx` (después de registrar pago exitoso):**
- En vez de solo mostrar toast, mostrar toast con CTA "Ver recibo"
- Click en CTA navega a `/[slug]/recibos/{nuevo_pago_id}`
- O agregar un botón secundario "Imprimir recibo" arriba del "Registrar pago"

**En `PagosFeed.tsx` (lista de pagos del día):**
- Agregar ícono pequeño de recibo (`LuReceipt`) en cada fila, click abre el recibo en nueva pestaña

**En detalle de miembro (`PagosHistory.tsx`):**
- Mismo ícono de recibo en cada pago del historial

### Configuración del gym

Agregar nuevo tab a `/configuracion` llamado "Mi gimnasio":

`components/configuracion/GymConfigManager.tsx`:
- Form para editar: nombre, telefono, direccion, rfc, logo_url
- Vista previa del recibo a la derecha (usando los datos del form)

Server Action en `app/(tenant)/[slug]/configuracion/gym/actions.ts`.

### Diseño de impresión

El recibo se ve bien en pantalla (dark mode) pero al imprimir:
```css
@media print {
  /* Fondo blanco, texto negro */
  body { background: white !important; color: black !important; }
  /* Esconder navegación, sidebar, header */
  .no-print { display: none !important; }
  /* Tamaño carta */
  @page { size: letter; margin: 1cm; }
}
```

Layout sugerido (imprimible):

```
┌──────────────────────────────────────┐
│  [LOGO]              GYM DEMO        │
│                      Tel: 55 1234... │
│                      Av. Ejemplo 123 │
├──────────────────────────────────────┤
│  RECIBO DE PAGO       Folio: #0123   │
│  Fecha: 15 jun 2026   14:32          │
├──────────────────────────────────────┤
│  Cliente: Juan Pérez Hernández       │
│  Concepto: Membresía Mensualidad     │
│  Vigencia: 15/06/2026 → 15/07/2026   │
│  Método: Efectivo                    │
├──────────────────────────────────────┤
│                                      │
│           TOTAL: $500.00 MXN         │
│                                      │
├──────────────────────────────────────┤
│  Gracias por tu preferencia          │
│  STRING GYM                          │
└──────────────────────────────────────┘
```

---

## CRITERIOS DE ACEPTACIÓN ACTUALIZADOS

(Agregar a los 14 anteriores)

15. SQL de folio + datos del gym ejecutado sin errores
16. Pagos existentes tienen folio asignado por backfill
17. Configurar datos del gym (teléfono, dirección, logo) en /configuracion/gym
18. Registrar nuevo pago → toast tiene CTA "Ver recibo"
19. Recibo se ve bien en pantalla y al imprimirlo (vista previa de impresión limpia)
20. Compartir recibo por WhatsApp abre `wa.me` con link del recibo
