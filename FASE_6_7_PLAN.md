# Fase 6.7 — Personalización de marca del gym

> Plan de implementación para Claude Code. Lee este documento completo
> antes de empezar y pregunta lo que no quede claro.

---

## Contexto

Fase 6.6 cerrada (infraestructura de add-ons). Antes de Fase 7 (Landings)
necesitamos resolver la personalización de marca para que cuando se
construyan las landings, el logo y colores del gym ya estén disponibles
como base.

Esta fase implementa lo decidido en el documento maestro sección 11
(Personalización de marca por plan):

- **Básico:** logo del gym en sidebar, header y recibos
- **Pro:** todo lo de Básico + color de acento + color de sidebar personalizables
- **Escala:** todo lo de Pro + favicon + pantalla de login con branding (futuro)

---

## ALCANCE DE FASE 6.7

1. Upload de logo a Supabase Storage (bucket `gym-logos` con RLS)
2. Campos `color_acento` y `color_sidebar` en tabla `gyms`
3. Componente reutilizable de file upload con drag&drop
4. Color pickers con preview en vivo
5. Display de logo en sidebar reemplazando el nombre
6. Display de logo en recibos imprimibles
7. Display de logo en pantalla kiosco de check-in
8. Aplicación de colores personalizados al SaaS interno (solo Pro+)
9. Pantalla `/configuracion/marca` con preview en tiempo real
10. FeatureGate para color personalizado (solo Pro+)

**Importante:** Los colores personalizados aplican TANTO al SaaS interno
(lo que ve el dueño y staff) COMO a las futuras landings públicas. El
verde STRING #50ff05 sigue siendo el default cuando el gym no personaliza.

---

## DECISIÓN ARQUITECTÓNICA — Colores en SaaS interno

Esta es una decisión importante. La sección 11 del doc maestro dice que
Pro+ desbloquea colores personalizados. Esto APLICA AL SISTEMA COMPLETO,
no solo a landings.

**Por qué:**
- El argumento de venta del dueño es ver "su gym" en la pantalla del
  kiosco (sección 11 del doc maestro)
- Los recepcionistas ven el sistema todo el día — tener la marca del
  gym ahí refuerza identidad
- Diferencia clara entre Plan Básico (default STRING) y Pro+ (marca del gym)

**Cómo funciona técnicamente:**
- Variables CSS se inyectan dinámicamente en `app/(tenant)/[slug]/layout.tsx`
- `style` tag con CSS variables sobreescritas:
  ```css
  :root {
    --brand-green: <color_acento del gym>;
    --bg-sidebar: <color_sidebar del gym>;
  }
  ```
- Si el gym es Plan Básico o no ha personalizado: usa los defaults
  STRING (#50ff05 y #141414)
- Si el gym es Plan Pro+ y personalizó: usa sus colores

**Lo que NO cambia con personalización:**
- Estructura visual del sistema
- Componentes UI (botones, modales, drawers)
- Tipografía (Anton, Geist, Ubuntu Mono se mantienen)
- Solo cambian las dos variables de color principales

---

## MIGRACIÓN SQL — Correr ANTES de empezar el código

Crear archivo `sql/010_marca_personalizada.sql`:

```sql
-- Campos de personalización en gyms
alter table gyms
  add column if not exists logo_url text,
  add column if not exists color_acento text default '#50ff05',
  add column if not exists color_sidebar text default '#141414',
  add column if not exists favicon_url text;

-- Validaciones de formato HEX
alter table gyms
  add constraint check_color_acento_hex
    check (color_acento is null or color_acento ~ '^#[0-9a-fA-F]{6}$');

alter table gyms
  add constraint check_color_sidebar_hex
    check (color_sidebar is null or color_sidebar ~ '^#[0-9a-fA-F]{6}$');

-- Bucket de Supabase Storage para logos
insert into storage.buckets (id, name, public)
values ('gym-logos', 'gym-logos', true)
on conflict (id) do nothing;

-- RLS policies para el bucket
-- Solo el owner del gym puede subir/modificar el logo de su gym
create policy "tenants_can_upload_own_logo"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gym-logos'
  and (storage.foldername(name))[1] in (
    select id::text from gyms where owner_id = auth.uid()
  )
);

create policy "tenants_can_update_own_logo"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'gym-logos'
  and (storage.foldername(name))[1] in (
    select id::text from gyms where owner_id = auth.uid()
  )
);

create policy "tenants_can_delete_own_logo"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'gym-logos'
  and (storage.foldername(name))[1] in (
    select id::text from gyms where owner_id = auth.uid()
  )
);

-- Lectura pública del bucket (logos son visibles para todos)
create policy "public_read_gym_logos"
on storage.objects
for select
to public
using (bucket_id = 'gym-logos');
```

**Estructura de archivos en el bucket:**
- Path: `{gym_id}/logo.{ext}` — un logo por gym
- Ejemplo: `b87463fa-ce58-41ae-bbd3-3cc89d9d564b/logo.png`
- Cuando el gym cambia logo, se sobreescribe el archivo

---

## EXTENDER FeatureGate

Archivo `lib/features.ts` — agregar nuevas features:

```typescript
// Agregar a planFeatures.basico
'personalizacion_logo'

// Agregar a planFeatures.pro
'personalizacion_colores'

// Agregar a planFeatures.escala
'personalizacion_avanzada'  // favicon + login branding (futuro)
```

Por herencia jerárquica:
- Básico tiene: logo
- Pro tiene: logo + colores
- Escala tiene: logo + colores + avanzada

---

## COMPONENTES NUEVOS

### 1. `components/ui/FileUpload.tsx` — Drag & drop reutilizable

Componente genérico para uploads. Props:

```typescript
interface FileUploadProps {
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  accept?: string;  // ej: 'image/png,image/jpeg,image/svg+xml'
  maxSizeMB?: number;  // default 2
  label?: string;
  description?: string;
}
```

Características:
- Drag & drop con feedback visual
- File picker como fallback (click)
- Preview del archivo actual si existe
- Validación de tamaño y tipo
- Estados: idle / dragging / uploading / success / error
- Botón "Eliminar" si hay archivo
- Loading spinner durante upload

### 2. `components/ui/ColorPicker.tsx` — Selector de color HEX

Props:

```typescript
interface ColorPickerProps {
  value: string;  // hex format '#RRGGBB'
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];  // colores sugeridos
  disabled?: boolean;
}
```

Características:
- Input HEX con validación
- Native `<input type="color">` como picker
- Botones de colores preset (8 colores comunes)
- Preview en vivo del color seleccionado
- Si valor inválido: marca rojo y muestra error

### 3. `components/configuracion/MarcaForm.tsx` — Form principal

Server component que carga datos del gym y renderiza el cliente.

Cliente (`MarcaFormClient.tsx`):
- Sección "Logo del gym" (todos los planes):
  - FileUpload con logo actual
  - Hint: "PNG, JPG, SVG o WEBP. Máximo 2MB. Mínimo 512x512px."
  - Estado de carga
- Sección "Colores de marca" (Pro+):
  - Si no es Pro+: muestra placeholder con CTA de upgrade
  - Si es Pro+:
    - ColorPicker para `color_acento`
    - ColorPicker para `color_sidebar`
    - Botón "Restaurar defaults" (#50ff05 / #141414)
    - Presets: verde STRING, azul, púrpura, naranja, rojo, etc.
- Sección "Vista previa" (siempre visible):
  - Mini-mockup del sidebar con el logo y color sidebar
  - Mini-mockup de un botón con el color acento
  - Mini-mockup de cómo se ve un badge/tag
  - Se actualiza en tiempo real conforme cambian los inputs
- Botón "Guardar cambios" al final

### 4. `components/configuracion/MarcaPreview.tsx` — Preview lateral

Renderiza vista previa en tiempo real de cómo se verá la marca aplicada.

Recibe props: `{ logoUrl, colorAcento, colorSidebar }`

Muestra:
- Sidebar simulado con logo y color sidebar
- Botón primario con color acento
- Badge de estado activo con color acento
- Indicador de "Hoy" en el sidebar con color acento

---

## PÁGINA NUEVA

### `app/(tenant)/[slug]/configuracion/marca/page.tsx`

Server component:
1. `getTenant()`
2. Verifica feature `personalizacion_logo` (siempre true, todos los planes)
3. Carga `gym` completo con logo_url, color_acento, color_sidebar
4. Renderiza `<MarcaForm>` con datos iniciales

---

## SERVER ACTIONS

`app/(tenant)/[slug]/configuracion/marca/actions.ts`:

### `updateMarcaAction`

```typescript
export async function updateMarcaAction(
  _prev: State,
  formData: FormData
): Promise<State>
```

Recibe: `color_acento`, `color_sidebar`
Valida:
- HEX format con regex `^#[0-9A-Fa-f]{6}$`
- Solo si el gym tiene plan Pro+ (gate doble: cliente + servidor)
Actualiza tabla `gyms`
Revalida path `/[slug]` para que el layout se re-renderice con colores nuevos

### `uploadLogoAction`

```typescript
export async function uploadLogoAction(
  formData: FormData  // contiene File
): Promise<{ ok: boolean; url?: string; error?: string }>
```

Pasos:
1. Obtiene tenant
2. Valida que el archivo sea image (PNG/JPG/SVG/WEBP)
3. Valida tamaño <= 2MB
4. Sube a Supabase Storage en `gym-logos/{gym_id}/logo.{ext}`
5. Obtiene URL pública
6. Actualiza `gyms.logo_url`
7. Revalida path `/[slug]`
8. Retorna URL

### `deleteLogoAction`

```typescript
export async function deleteLogoAction(): Promise<{ ok: boolean }>
```

1. Obtiene tenant
2. Elimina archivo de Storage
3. Actualiza `gyms.logo_url = null`
4. Revalida path `/[slug]`

---

## QUERIES

`lib/queries/marca.queries.ts`:

```typescript
export interface GymMarca {
  id: string;
  logo_url: string | null;
  color_acento: string;
  color_sidebar: string;
  favicon_url: string | null;
}

export async function getGymMarca(tenantId: string): Promise<GymMarca | null>
export async function updateGymMarca(
  tenantId: string,
  data: Partial<Pick<GymMarca, 'color_acento' | 'color_sidebar'>>
): Promise<{ ok: boolean; error?: string }>
export async function updateGymLogo(
  tenantId: string,
  logoUrl: string | null
): Promise<{ ok: boolean; error?: string }>
```

---

## INTEGRACIÓN — Aplicar colores y logo en el sistema

### 1. Layout del tenant aplica colores dinámicos

`app/(tenant)/[slug]/layout.tsx`:

Agregar lectura de marca del gym y inyectar variables CSS:

```typescript
const marca = await getGymMarca(tenant.id);

// En el JSX, dentro del layout:
{marca && (tenant.plan === 'pro' || tenant.plan === 'escala') && (
  <style dangerouslySetInnerHTML={{
    __html: `
      :root {
        --brand-green: ${marca.color_acento};
        --bg-sidebar: ${marca.color_sidebar};
      }
    `
  }} />
)}
```

**Importante:** Plan Básico NO recibe los colores personalizados aunque
los tenga guardados — los defaults STRING aplican.

### 2. Sidebar muestra logo en lugar de texto

`components/layout/Sidebar.tsx` (o donde esté el header del sidebar):

```typescript
{gym.logo_url ? (
  <Image
    src={gym.logo_url}
    alt={gym.nombre}
    width={120}
    height={40}
    className="object-contain"
  />
) : (
  <h1 className="font-display text-xl">{gym.nombre}</h1>
)}
```

### 3. Recibos imprimibles incluyen logo

`app/(tenant)/[slug]/recibos/[pagoId]/page.tsx`:

Si `gym.logo_url` existe, mostrar arriba del recibo en lugar del texto del
nombre del gym. Tamaño máximo 200x60px en print.

### 4. Pantalla kiosco con identidad

`app/(tenant)/[slug]/checkins/kiosco/page.tsx`:

Logo del gym en posición prominente arriba (no solo el nombre).

---

## CONFIGURACIÓN — Agregar tab "Marca"

`components/configuracion/ConfigTabs.tsx`:

Agregar nueva tab "Marca" con icono `LuPalette`.
Posición sugerida: después de "Mi gimnasio", antes de "Planes".
Visible para TODOS los planes (Básico solo verá logo; Pro+ verá logo + colores).

---

## CONSIDERACIONES DE PERFORMANCE

- Las imágenes de logo se cargan con `next/image` para optimización automática
- Cache de Supabase Storage: usar `revalidate` apropiado
- Si el logo cambia, el nombre del archivo NO cambia (es `logo.ext`) — se
  agrega `?v=timestamp` al URL para bustear cache cuando se actualiza
- El `<style>` inline en el layout NO genera FOUC porque es server-rendered

---

## ENTREGABLES

### Archivos NUEVOS

```
sql/010_marca_personalizada.sql

components/ui/FileUpload.tsx
components/ui/ColorPicker.tsx
components/configuracion/MarcaForm.tsx
components/configuracion/MarcaFormClient.tsx
components/configuracion/MarcaPreview.tsx

app/(tenant)/[slug]/configuracion/marca/page.tsx
app/(tenant)/[slug]/configuracion/marca/actions.ts

lib/queries/marca.queries.ts
lib/validations/marca.schema.ts
```

### Archivos MODIFICADOS

```
lib/features.ts                              -- nuevas features de personalización
app/(tenant)/[slug]/layout.tsx               -- inyección de CSS variables + logo
components/layout/Sidebar.tsx                -- logo en lugar de texto
components/configuracion/ConfigTabs.tsx      -- tab "Marca"
app/(tenant)/[slug]/recibos/[pagoId]/page.tsx -- logo en recibo
app/(tenant)/[slug]/checkins/kiosco/page.tsx -- logo en kiosco
```

### SQL a correr en Supabase

Migración `sql/010_marca_personalizada.sql` (el bloque al inicio del documento).

---

## CRITERIOS DE ACEPTACIÓN

1. ✅ SQL ejecutado sin errores. Bucket `gym-logos` creado.
2. ✅ Pantalla `/configuracion/marca` carga correctamente.
3. ✅ Subir logo PNG/JPG/SVG funciona — archivo aparece en Storage.
4. ✅ Logo se ve inmediatamente en sidebar después de subir.
5. ✅ Logo se ve en recibos imprimibles.
6. ✅ Logo se ve en kiosco de check-in.
7. ✅ Para Plan Básico: pickers de color están deshabilitados con CTA de upgrade.
8. ✅ Para Plan Pro+: pickers de color funcionan.
9. ✅ Cambiar color_acento se refleja en botones, badges, indicador "Hoy" del sidebar.
10. ✅ Cambiar color_sidebar se refleja en fondo del sidebar.
11. ✅ Preview en tiempo real muestra cambios antes de guardar.
12. ✅ Botón "Restaurar defaults" devuelve a #50ff05 y #141414.
13. ✅ Validación HEX en server action (no se puede meter color inválido).
14. ✅ Validación de tamaño en upload (>2MB rechaza con mensaje claro).
15. ✅ Validación de tipo de archivo (rechaza .pdf, .txt, etc.).
16. ✅ Build pasa sin errores TypeScript.

---

## ORDEN SUGERIDO DE IMPLEMENTACIÓN

1. **SQL primero** — ejecutar migración 010 en Supabase
2. **Features extendidas** — `lib/features.ts` con nuevas features
3. **Validaciones Zod** — `lib/validations/marca.schema.ts`
4. **Queries** — `lib/queries/marca.queries.ts`
5. **Componentes base** — `FileUpload.tsx` + `ColorPicker.tsx`
6. **Server Actions** — `actions.ts`
7. **Form principal** — `MarcaForm.tsx` + `MarcaFormClient.tsx`
8. **Preview** — `MarcaPreview.tsx`
9. **Página** — `marca/page.tsx`
10. **Integración layout** — inyección de CSS variables
11. **Integración sidebar** — display de logo
12. **Integración recibos y kiosco**
13. **Tab "Marca" en ConfigTabs**
14. **Testing manual end-to-end**

Commits intermedios entre cada paso.

---

## CONVENCIONES (recordatorio)

- TypeScript estricto, NUNCA `any`
- Zod v4: usa `error:` (no `invalid_type_error:`)
- Variables CSS para colores en todos los componentes
- Toasts con `useToast()` de `@/components/ui/Toast`
- Server Actions con patrón estándar (State + fieldErrors)
- Modal con `<Modal>`, Drawer con `<Drawer>`
- No console.log en producción
- Imports: externos primero, luego internos, luego tipos, luego componente

---

## PREGUNTAS ANTES DE EMPEZAR

Si encuentras algo que no quede claro, pregunta. En particular:

- Si la estructura actual de `Sidebar.tsx` no permite fácilmente
  reemplazar el nombre del gym con un logo
- Si Supabase Storage requiere configuración adicional en el dashboard
  además de las policies SQL
- Si la pantalla de kiosco tiene su propio layout que requiere ajuste

---

**NOTA:** Esta fase es de tamaño mediano (~5-6 horas), no la más chica.
Tiene varios puntos de integración con el sistema existente. Hacer
commits intermedios después de cada bloque grande (después de SQL,
después de componentes base, después de form, después de integraciones).

---

## DESPUÉS DE TERMINAR

Para confirmar que Fase 6.7 está cerrada:

1. Probar con gym Plan Básico: solo puede cambiar logo
2. Probar con gym Plan Pro: puede cambiar logo + colores
3. Cambiar plan del demo gym en Supabase entre básico/pro y verificar que
   el FeatureGate funciona correctamente
4. Subir logos de diferentes tamaños (chico, grande, no cuadrado)
   y verificar que se ven bien en sidebar/recibos/kiosco
5. Probar colores extremos (negro puro, blanco, rojo brillante) y
   verificar que el sistema sigue siendo legible
6. Probar restaurar defaults
7. Probar eliminar logo (vuelve a texto del nombre)

Volver a chat de STRING GYM Dev (claude.ai) para:
- Confirmar cierre de Fase 6.7
- Actualizar Notion con detalles de implementación
- Arrancar plan de Fase 6.8 (Multiusuario con roles Staff)
