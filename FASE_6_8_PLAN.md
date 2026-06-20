# Fase 6.8 — Multiusuario con roles Staff

> Plan de implementación para Claude Code. Lee este documento completo
> antes de empezar y pregunta lo que no quede claro.

---

## Contexto

Fase 6.7 cerrada (personalización de marca). Ahora viene la fase más
crítica del bloqueo de venta: **multiusuario con roles**.

Sin esta fase, un gym con 2 recepcionistas tendría que compartir la
contraseña del owner. Ningún cliente serio lo aceptaría — sería
inseguro y poco profesional.

Esta fase implementa lo decidido en el documento maestro secciones 23.2
(Auth Staff) y 23.3 (Matriz de permisos).

---

## ALCANCE DE FASE 6.8

1. Tabla `staff` para registrar miembros del equipo del gym
2. Sistema de invitación por email (Supabase Auth invite)
3. Auth con email + password real, sesión 24h
4. Pantalla `/configuracion/staff` para owner gestionar equipo
5. Roles: `owner` (dueño) y `receptionist` (recepcionista)
6. Matriz de permisos aplicada en TODO el sistema
7. Helper `hasPermission(action, role)` reutilizable
8. UI condicional según rol (sidebar oculta secciones, botones desaparecen)
9. Protección server-side (server actions verifican rol)
10. Pantalla de "Sin permiso" cuando un recepcionista intenta acceder a algo bloqueado

---

## MATRIZ DE PERMISOS — Definitiva (sección 23.3 doc maestro)

| Acción | Owner | Receptionist |
|--------|-------|--------------|
| Ver dashboard de ingresos | ✅ | ❌ |
| Ver check-ins del día | ✅ | ✅ |
| Crear miembros nuevos | ✅ | ✅ |
| Editar miembros | ✅ | ✅ |
| Eliminar / archivar miembros | ✅ | ❌ |
| Registrar pagos | ✅ | ✅ |
| Cancelar pagos ya registrados | ✅ | ❌ |
| Ver historial de pagos | ✅ | ✅ (solo del día) |
| Hacer check-in manual | ✅ | ✅ |
| Ver inventario | ✅ | ✅ (solo stock, no movimientos) |
| Vender desde caja (descontar stock) | ✅ | ✅ |
| Ver prospectos | ✅ | ❌ |
| Configurar planes y promociones | ✅ | ❌ |
| Gestionar staff | ✅ | ❌ |
| Configuración general / marca | ✅ | ❌ |

**Lógica:** el recepcionista opera día a día (cobrar, registrar, hacer
check-in, vender mostrador). NO ve finanzas, NO toca configuración,
NO ve prospectos.

---

## MIGRACIÓN SQL — Correr ANTES de empezar el código

Crear archivo `sql/011_staff_multiusuario.sql`:

```sql
-- Tabla de staff (recepcionistas del gym)
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null default 'receptionist' check (rol in ('owner', 'receptionist')),
  estado text not null default 'invitado' check (estado in (
    'invitado',     -- recibió email, aún no aceptó
    'activo',       -- aceptó invitación y puede entrar
    'desactivado'   -- el owner lo desactivó manualmente
  )),
  created_at timestamptz not null default now(),
  activado_at timestamptz,
  desactivado_at timestamptz,
  ultima_sesion_at timestamptz,

  unique (gym_id, email)
);

create index idx_staff_gym on staff(gym_id);
create index idx_staff_user on staff(user_id);
create index idx_staff_email on staff(email);
create index idx_staff_activos on staff(gym_id, estado) where estado = 'activo';

-- RLS — solo el owner del gym puede ver/gestionar el staff de su gym
alter table staff enable row level security;

create policy "owner_can_view_staff"
on staff for select
to authenticated
using (
  gym_id in (select id from gyms where owner_id = auth.uid())
);

create policy "owner_can_insert_staff"
on staff for insert
to authenticated
with check (
  gym_id in (select id from gyms where owner_id = auth.uid())
);

create policy "owner_can_update_staff"
on staff for update
to authenticated
using (
  gym_id in (select id from gyms where owner_id = auth.uid())
);

create policy "owner_can_delete_staff"
on staff for delete
to authenticated
using (
  gym_id in (select id from gyms where owner_id = auth.uid())
);

-- Trigger para crear automáticamente staff "owner" cuando se crea un gym
create or replace function create_owner_staff()
returns trigger as $$
begin
  insert into staff (gym_id, user_id, email, nombre, rol, estado, activado_at)
  values (
    new.id,
    new.owner_id,
    (select email from auth.users where id = new.owner_id),
    coalesce((select raw_user_meta_data->>'nombre' from auth.users where id = new.owner_id), 'Owner'),
    'owner',
    'activo',
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_create_owner_staff on gyms;
create trigger trigger_create_owner_staff
  after insert on gyms
  for each row
  execute function create_owner_staff();

-- Backfill: crear registro de staff "owner" para gyms existentes que no lo tienen
insert into staff (gym_id, user_id, email, nombre, rol, estado, activado_at)
select
  g.id,
  g.owner_id,
  u.email,
  coalesce(u.raw_user_meta_data->>'nombre', 'Owner'),
  'owner',
  'activo',
  now()
from gyms g
join auth.users u on u.id = g.owner_id
where not exists (
  select 1 from staff s where s.gym_id = g.id and s.rol = 'owner'
);

-- Vista auxiliar para obtener el rol del usuario actual en un gym
create or replace view current_user_role_in_gym as
select
  s.gym_id,
  s.rol,
  s.estado
from staff s
where s.user_id = auth.uid()
  and s.estado = 'activo';
```

---

## TYPES Y CONSTANTS

`lib/types/staff.ts`:

```typescript
export type StaffRol = 'owner' | 'receptionist';
export type StaffEstado = 'invitado' | 'activo' | 'desactivado';

export interface Staff {
  id: string;
  gym_id: string;
  user_id: string | null;
  email: string;
  nombre: string;
  rol: StaffRol;
  estado: StaffEstado;
  created_at: string;
  activado_at: string | null;
  desactivado_at: string | null;
  ultima_sesion_at: string | null;
}

export type Permission =
  | 'ver_dashboard_ingresos'
  | 'ver_checkins_dia'
  | 'crear_miembros'
  | 'editar_miembros'
  | 'eliminar_archivar_miembros'
  | 'registrar_pagos'
  | 'cancelar_pagos'
  | 'ver_historial_pagos_completo'
  | 'ver_historial_pagos_dia'
  | 'hacer_checkin_manual'
  | 'ver_inventario_stock'
  | 'ver_inventario_movimientos'
  | 'vender_desde_caja'
  | 'ver_prospectos'
  | 'configurar_planes_promociones'
  | 'gestionar_staff'
  | 'configurar_general'
  | 'ver_alertas'
  | 'ver_dashboard_completo'
  | 'ver_pantalla_hoy';
```

---

## SISTEMA DE PERMISOS — Helper central

`lib/permissions.ts`:

```typescript
import type { StaffRol, Permission } from './types/staff';

const PERMISSIONS_BY_ROLE: Record<StaffRol, Permission[]> = {
  owner: [
    'ver_dashboard_ingresos',
    'ver_checkins_dia',
    'crear_miembros',
    'editar_miembros',
    'eliminar_archivar_miembros',
    'registrar_pagos',
    'cancelar_pagos',
    'ver_historial_pagos_completo',
    'ver_historial_pagos_dia',
    'hacer_checkin_manual',
    'ver_inventario_stock',
    'ver_inventario_movimientos',
    'vender_desde_caja',
    'ver_prospectos',
    'configurar_planes_promociones',
    'gestionar_staff',
    'configurar_general',
    'ver_alertas',
    'ver_dashboard_completo',
    'ver_pantalla_hoy',
  ],
  receptionist: [
    'ver_checkins_dia',
    'crear_miembros',
    'editar_miembros',
    'registrar_pagos',
    'ver_historial_pagos_dia',
    'hacer_checkin_manual',
    'ver_inventario_stock',
    'vender_desde_caja',
  ],
};

export function hasPermission(rol: StaffRol, permission: Permission): boolean {
  return PERMISSIONS_BY_ROLE[rol]?.includes(permission) ?? false;
}

export function getPermissions(rol: StaffRol): Permission[] {
  return PERMISSIONS_BY_ROLE[rol] ?? [];
}
```

---

## CONTEXTO — Staff actual del usuario

`lib/contexts/StaffContext.tsx`:

```typescript
'use client';
import { createContext, useContext, ReactNode } from 'react';
import type { Staff } from '@/lib/types/staff';
import { hasPermission } from '@/lib/permissions';
import type { Permission } from '@/lib/types/staff';

interface StaffContextValue {
  staff: Staff | null;
  isOwner: boolean;
  isReceptionist: boolean;
  can: (permission: Permission) => boolean;
}

const StaffContext = createContext<StaffContextValue>({
  staff: null,
  isOwner: false,
  isReceptionist: false,
  can: () => false,
});

export function StaffProvider({
  children,
  staff
}: {
  children: ReactNode;
  staff: Staff | null;
}) {
  const value: StaffContextValue = {
    staff,
    isOwner: staff?.rol === 'owner',
    isReceptionist: staff?.rol === 'receptionist',
    can: (permission) => staff ? hasPermission(staff.rol, permission) : false,
  };
  return (
    <StaffContext.Provider value={value}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff() {
  return useContext(StaffContext);
}

export function useCan(permission: Permission): boolean {
  const { can } = useStaff();
  return can(permission);
}
```

---

## ACTUALIZAR `getTenant()` para incluir rol del usuario

`lib/tenant.ts` — extender para devolver también el `staff` actual:

```typescript
export interface TenantContext {
  // ... lo que ya tenía
  currentStaff: Staff | null;  // NUEVO
}

export async function getTenant(): Promise<TenantContext> {
  // ... lógica existente
  
  // NUEVO: obtener el staff del usuario actual en este gym
  const { data: currentStaff } = await supabase
    .from('staff')
    .select('*')
    .eq('gym_id', tenant.id)
    .eq('user_id', user.id)
    .eq('estado', 'activo')
    .maybeSingle();
  
  return {
    ...tenant,
    currentStaff,
  };
}
```

---

## INTEGRACIÓN — Layout del tenant carga staff y provee contexto

`app/(tenant)/[slug]/layout.tsx`:

```typescript
const tenant = await getTenant();

// Si el usuario NO tiene staff activo en este gym, NO puede entrar
if (!tenant.currentStaff) {
  redirect('/login?error=no-access');
}

return (
  <StaffProvider staff={tenant.currentStaff}>
    {/* resto del layout */}
  </StaffProvider>
);
```

---

## PANTALLA NUEVA — `/configuracion/staff`

`app/(tenant)/[slug]/configuracion/staff/page.tsx`:

Server component:
1. `getTenant()` con currentStaff
2. Verifica permission `gestionar_staff` — si no, redirige a página "Sin permiso"
3. Carga lista completa de staff del gym
4. Renderiza componente cliente

### Componente `StaffManager.tsx`

Layout:
- Header: "Equipo de [nombre del gym]"
- Botón principal: "Invitar recepcionista" (abre Modal)
- Lista de staff con cards:
  - Foto (avatar con inicial), nombre, email, rol, estado
  - Badge de estado (invitado/activo/desactivado)
  - Última sesión (si está activo)
  - Botones según rol:
    - Owner: solo se muestra, no se puede modificar
    - Receptionist:
      - Si invitado: "Reenviar invitación" + "Cancelar invitación"
      - Si activo: "Desactivar"
      - Si desactivado: "Reactivar" + "Eliminar permanentemente"

### Componente `InviteStaffModal.tsx`

Form con campos:
- Email (validación)
- Nombre completo
- Rol (por ahora solo "Receptionist", fijo)

Al enviar:
1. Crea registro en `staff` con estado `invitado`
2. Llama a Supabase Auth invite con redirect a `/auth/accept-invite?gym_id=X&token=Y`
3. Toast de éxito
4. Refresca lista

### Pantalla de aceptar invitación

`app/(auth)/accept-invite/page.tsx`:

1. Lee token del URL
2. Verifica que el token sea válido (Supabase Auth handle)
3. Pide al usuario:
   - Nombre (prefilled del staff record)
   - Crear password
4. Al confirmar:
   - Supabase Auth crea el user
   - Update staff: `user_id = nuevo user id, estado = activo, activado_at = now()`
5. Redirige a `/[slug]/checkins` (pantalla principal del recepcionista)

---

## SERVER ACTIONS

`app/(tenant)/[slug]/configuracion/staff/actions.ts`:

### `inviteStaffAction`

```typescript
export async function inviteStaffAction(
  _prev: State,
  formData: FormData
): Promise<State>
```

1. Verifica que current user es owner (gate doble)
2. Valida email + nombre con Zod
3. Verifica que email no esté ya invitado en este gym
4. Crea registro en `staff` con estado `invitado`
5. Llama a Supabase Admin API para crear invitación
6. Manda email con link de invitación
7. revalidatePath y retorna éxito

### `resendInviteAction`
### `cancelInviteAction`
### `deactivateStaffAction`
### `reactivateStaffAction`
### `deleteStaffAction`

Todas siguen el mismo patrón: verifican que el usuario es owner, ejecutan
la acción en BD, revalidan path.

**Importante:** NINGUNA acción permite desactivar/eliminar al owner.

---

## APLICAR PERMISOS EN EL SISTEMA — TODOS los puntos

Esta es la parte grande y delicada. Hay que tocar varios componentes
para aplicar permisos correctamente.

### 1. Sidebar — Ocultar links según permisos

`components/layout/Sidebar.tsx`:

```typescript
const { can } = useStaff();

const links = [
  { href: '/hoy', label: 'Hoy', icon: LuLayoutDashboard, permission: 'ver_pantalla_hoy' },
  { href: '/dashboard', label: 'Dashboard', icon: LuChartBar, permission: 'ver_dashboard_completo' },
  { href: '/checkins', label: 'Check-ins', icon: LuClock, permission: 'ver_checkins_dia' },
  { href: '/miembros', label: 'Miembros', icon: LuUsers, permission: 'crear_miembros' },
  { href: '/caja', label: 'Caja', icon: LuDollarSign, permission: 'registrar_pagos' },
  { href: '/inventario', label: 'Inventario', icon: LuPackage, permission: 'ver_inventario_stock' },
  { href: '/prospectos', label: 'Prospectos', icon: LuTarget, permission: 'ver_prospectos' },
  { href: '/alertas', label: 'Alertas', icon: LuBell, permission: 'ver_alertas' },
  { href: '/configuracion', label: 'Configuración', icon: LuSettings, permission: 'configurar_general' },
];

// Filtrar según permisos
const visibleLinks = links.filter(link => can(link.permission));
```

### 2. Dashboard — Mostrar solo lo permitido

`app/(tenant)/[slug]/dashboard/page.tsx`:

Si el usuario NO tiene `ver_dashboard_ingresos`, ocultar las 3 cards de ingresos.
Si NO tiene `ver_dashboard_completo`, redirigir a `/checkins`.

### 3. Miembros — Botón de archivar

`components/miembros/MiembroDetail.tsx`:

Botón "Archivar miembro" solo visible si `can('eliminar_archivar_miembros')`.

### 4. Caja — Cancelar pago

`components/caja/PagoCard.tsx`:

Botón "Cancelar pago" solo visible si `can('cancelar_pagos')`.

### 5. Historial de pagos — Filtro de fechas

Si rol es `receptionist`, el filtro de fechas se fija en "Hoy" y NO se puede cambiar.
Si es `owner`, todos los filtros disponibles.

### 6. Inventario — Tab de movimientos

`components/inventario/InventarioTabs.tsx`:

Tab "Movimientos" solo visible si `can('ver_inventario_movimientos')`.

### 7. Configuración — Tabs según permisos

`components/configuracion/ConfigTabs.tsx`:

Receptionist NO ve ninguna tab de configuración. Si entra directo a la URL,
redirige a `/checkins` con toast "Sin permiso".

### 8. ConfigTabs — Solo el owner ve "Staff"

Tab "Staff" solo visible si `can('gestionar_staff')`.

### 9. Pantalla "Hoy"

Si rol es `receptionist`, NO accede a Hoy (es panel estratégico del dueño).
Redirige a `/checkins` que es su pantalla principal.

### 10. Prospectos

Si NO tiene `ver_prospectos`, redirige a `/checkins`.

### 11. Alertas

Si NO tiene `ver_alertas`, redirige a `/checkins`.

---

## PANTALLA "SIN PERMISO"

`components/ui/AccessDenied.tsx`:

Componente reutilizable que se muestra cuando un recepcionista intenta
acceder a algo bloqueado vía URL directa:

```
🔒 Sin permiso para esta sección

Esta función está disponible solo para el dueño del gimnasio.
Si necesitas acceso, contacta al dueño.

[Volver a check-ins]
```

---

## SERVER-SIDE PROTECTION — TODOS los Server Actions

Cada server action que modifica datos críticos debe verificar permisos:

```typescript
'use server';

export async function archiveMiembroAction(...) {
  const tenant = await getTenant();
  
  // GATE DOBLE: verificar permiso en server
  if (!hasPermission(tenant.currentStaff?.rol ?? 'receptionist', 'eliminar_archivar_miembros')) {
    return { ok: false, error: 'Sin permiso', fieldErrors: {} };
  }
  
  // ... lógica existente
}
```

Acciones que requieren gate server-side:
- `archiveMiembroAction` → `eliminar_archivar_miembros`
- `deleteMiembroAction` → `eliminar_archivar_miembros`
- `cancelPagoAction` → `cancelar_pagos`
- `createPlanAction` → `configurar_planes_promociones`
- `updatePlanAction` → `configurar_planes_promociones`
- `deletePlanAction` → `configurar_planes_promociones`
- `createPromocionAction` → `configurar_planes_promociones`
- (similar para promos, tags, plantillas)
- `updateGymAction` → `configurar_general`
- `updateMarcaAction` → `configurar_general`
- TODOS los actions de `/configuracion/staff` → `gestionar_staff`

---

## RUTAS PROTEGIDAS — Verificación en server components

`app/(tenant)/[slug]/dashboard/page.tsx`:

```typescript
export default async function Page() {
  const tenant = await getTenant();
  
  if (!hasPermission(tenant.currentStaff?.rol ?? 'receptionist', 'ver_dashboard_completo')) {
    redirect(`/${tenant.slug}/checkins`);
  }
  
  // resto del component
}
```

Aplicar similar protección en:
- `/dashboard`
- `/hoy`
- `/prospectos`
- `/alertas`
- `/configuracion/*` (excepto si se decide que alguna tab es accesible)
- `/recibos/[pagoId]` (solo del día para receptionist — más complejo)

---

## ENTREGABLES

### Archivos NUEVOS

```
sql/011_staff_multiusuario.sql

lib/types/staff.ts
lib/permissions.ts
lib/contexts/StaffContext.tsx
lib/queries/staff.queries.ts
lib/validations/staff.schema.ts

components/configuracion/StaffManager.tsx
components/configuracion/InviteStaffModal.tsx
components/configuracion/StaffCard.tsx
components/ui/AccessDenied.tsx

app/(tenant)/[slug]/configuracion/staff/page.tsx
app/(tenant)/[slug]/configuracion/staff/actions.ts

app/(auth)/accept-invite/page.tsx
app/(auth)/accept-invite/actions.ts
```

### Archivos MODIFICADOS

```
lib/tenant.ts                                  -- incluir currentStaff
app/(tenant)/[slug]/layout.tsx                 -- StaffProvider
components/layout/Sidebar.tsx                  -- ocultar links por permiso
components/configuracion/ConfigTabs.tsx        -- tabs filtradas + nuevo tab Staff
app/(tenant)/[slug]/dashboard/page.tsx         -- gate
app/(tenant)/[slug]/hoy/page.tsx               -- gate
app/(tenant)/[slug]/prospectos/page.tsx        -- gate
app/(tenant)/[slug]/alertas/page.tsx           -- gate
app/(tenant)/[slug]/configuracion/*/page.tsx   -- gate (varios)
components/miembros/MiembroDetail.tsx          -- botón archivar condicional
components/caja/PagoCard.tsx                   -- botón cancelar condicional
components/inventario/InventarioTabs.tsx       -- tab movimientos condicional

// Server Actions con gate añadido:
app/(tenant)/[slug]/miembros/actions.ts
app/(tenant)/[slug]/caja/actions.ts
app/(tenant)/[slug]/configuracion/**/actions.ts
```

---

## CRITERIOS DE ACEPTACIÓN

1. ✅ SQL ejecutado. Tabla `staff` creada con RLS.
2. ✅ Trigger funciona: al crear nuevo gym, se crea automáticamente staff "owner"
3. ✅ Backfill ejecutado: todos los gyms existentes tienen staff "owner"
4. ✅ Owner puede entrar a `/configuracion/staff`
5. ✅ Owner puede invitar recepcionista por email
6. ✅ Recepcionista recibe email con link de invitación
7. ✅ Link funciona y permite crear password
8. ✅ Recepcionista loguea y entra a `/[slug]/checkins` directo
9. ✅ Recepcionista NO ve en sidebar: Hoy, Dashboard, Prospectos, Alertas, Configuración
10. ✅ Recepcionista SÍ ve: Check-ins, Miembros, Caja, Inventario
11. ✅ Recepcionista intenta `/dashboard` por URL → redirige a check-ins
12. ✅ Recepcionista NO ve botón "Archivar" en detalle de miembro
13. ✅ Recepcionista NO ve botón "Cancelar pago"
14. ✅ Recepcionista NO ve tab "Movimientos" en inventario
15. ✅ Recepcionista en historial de pagos: solo ve del día actual
16. ✅ Owner puede desactivar recepcionista → ya no puede entrar
17. ✅ Owner puede reactivar recepcionista desactivado
18. ✅ Owner NO puede eliminar/desactivar al owner (gym solo tiene 1 owner)
19. ✅ Si owner intenta forzar archive de miembro desde curl → 403
20. ✅ Build pasa sin errores TypeScript

---

## ORDEN SUGERIDO DE IMPLEMENTACIÓN

1. **SQL primero** — ejecutar migración 011 en Supabase
2. **Types y permisos** — `lib/types/staff.ts` + `lib/permissions.ts`
3. **Queries** — `lib/queries/staff.queries.ts`
4. **Validaciones** — `lib/validations/staff.schema.ts`
5. **Extender getTenant** — incluir currentStaff
6. **Contexto** — `StaffContext.tsx` + integrar en layout
7. **Pantalla `/configuracion/staff`** — manager + invite modal
8. **Server Actions** de staff management
9. **Pantalla aceptar invitación** — `/auth/accept-invite`
10. **Aplicar permisos en sidebar**
11. **Aplicar gates server-side en páginas protegidas**
12. **Aplicar gates en componentes** (botones condicionales)
13. **Aplicar gates en server actions críticos**
14. **Componente AccessDenied + redirects**
15. **Testing manual end-to-end**

Commits intermedios entre cada bloque grande:
- Commit 1: SQL + Types + Permisos + Queries + Context
- Commit 2: Pantalla staff + Modal invitar + actions
- Commit 3: Pantalla accept-invite
- Commit 4: Aplicación de permisos en sidebar + páginas
- Commit 5: Aplicación de permisos en componentes + actions

---

## CONVENCIONES (recordatorio)

- TypeScript estricto, NUNCA `any`
- Zod v4: usa `error:` (no `invalid_type_error:`)
- Variables CSS para colores
- Server Actions con patrón estándar (State + fieldErrors)
- Modal con `<Modal>`, Drawer con `<Drawer>`
- Toasts con `useToast()`
- Gate doble: cliente (UI) + servidor (action)
- Imports: externos → internos → tipos → componente

---

## PREGUNTAS ANTES DE EMPEZAR

Si encuentras algo que no quede claro, pregunta. En particular:

- **Supabase Auth invite API** — verificar que está habilitada en el
  proyecto. Si no, hay que activarla en Authentication → Email Templates.
- **Email templates de Supabase** — personalizar el template de
  invitación con marca STRING GYM
- **Service role key** — el `inviteStaffAction` requiere usar Supabase
  Admin API. Hay que configurar `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`
  y Vercel.
- **Redirect URLs en Supabase** — agregar `/auth/accept-invite` a
  Authentication → URL Configuration → Redirect URLs

---

**NOTA IMPORTANTE:** Esta es la fase MÁS GRANDE de las pre-venta (~7-8h).
Tiene muchos puntos de integración. Haz commits intermedios después de
cada bloque grande para poder volver atrás si algo se rompe.

**Antes de cada commit, verifica:**
- `npm run build` pasa sin errores
- `npm run lint` sin warnings críticos
- Probar manualmente que el bloque recién construido funciona

---

## DESPUÉS DE TERMINAR

Para confirmar que Fase 6.8 está cerrada:

1. Crear un nuevo gym de prueba (`gym-test-staff`)
2. Como owner, invitar un email de prueba (gmail temporal)
3. Aceptar invitación → crear password
4. Loguearse como recepcionista
5. Verificar TODAS las restricciones del checklist (1-19)
6. Volver como owner → desactivar recepcionista
7. Verificar que el recepcionista ya no puede entrar
8. Owner reactiva → recepcionista entra de nuevo

Volver a chat de STRING GYM Dev (claude.ai) para:
- Confirmar cierre de Fase 6.8
- Actualizar Notion con detalles de implementación
- Arrancar plan de Fase 6.9 (Importación CSV de miembros)
