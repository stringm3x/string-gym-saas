# Fase 6.6 — Infraestructura de Add-ons

> Plan de implementación para Claude Code. Mini-fase posterior a 6.5.
> Lee este documento completo antes de empezar y pregunta lo que no
> quede claro.

---

## Contexto

Fase 6.5 cerrada al 100% con los 3 planes diferenciados (Básico/Pro/Escala)
funcionando vía FeatureGates. Ahora se necesita la INFRAESTRUCTURA para
add-ons, que son funcionalidades extra contratables por encima del plan.

Diferencia con planes:
- Plan: nivel de suscripción (uno a la vez)
- Add-on: feature contratable extra, paga aparte, puedes tener varios
  activos simultáneamente

En esta fase NO se construye ningún add-on funcional todavía — solo la
infraestructura para activarlos/listarlos. Los add-ons reales llegan en
Fase 7+ (Landing dominio propio es el primero real).

---

## ALCANCE DE FASE 6.6

1. Tabla `gym_addons` para tracking de activaciones
2. Catálogo `ADDONS_CATALOG` con todos los add-ons (activos + próximamente)
3. Helper `hasAddon(tenantId, addonId)` 
4. Página visual `/configuracion/addons` con catálogo navegable
5. Activación manual desde Supabase (sin UI de pago todavía)
6. CTA "Contratar add-on" → WhatsApp soporte STRING (igual que UpgradePage)

---

## MIGRACIÓN SQL (correr ANTES de empezar el código)

```sql
create table gym_addons (
  tenant_id uuid references gyms(id) not null,
  addon_id text not null,
  estado text not null default 'activo' check (estado in (
    'activo', 'suspendido', 'cancelado'
  )),
  fecha_activacion timestamptz not null default now(),
  fecha_cancelacion timestamptz,
  precio_actual numeric not null,
  notas text,
  primary key (tenant_id, addon_id)
);

create index idx_gym_addons_tenant on gym_addons(tenant_id);
create index idx_gym_addons_activo on gym_addons(tenant_id, estado)
  where estado = 'activo';

alter table gym_addons enable row level security;

create policy "tenant_isolation_gym_addons" on gym_addons
  for all using (
    tenant_id in (select id from gyms where owner_id = auth.uid())
  );
```

---

## CATÁLOGO DE ADD-ONS

Archivo nuevo: `lib/addons.ts`

```typescript
export type AddonId =
  | 'landing_dominio'
  | 'ia_rutinas'
  | 'chatbot_captacion'
  | 'portal_miembro'
  | 'acceso_qr'
  | 'pasarela_pago'
  | 'creditos_cxc';

export type AddonEstado = 'disponible' | 'proximamente' | 'en_desarrollo';

export interface AddonDefinition {
  id: AddonId;
  nombre: string;
  descripcionCorta: string;
  descripcionLarga: string;
  precio: number;
  /** Plan mínimo requerido para contratar */
  planMinimo: 'basico' | 'pro' | 'escala';
  estado: AddonEstado;
  /** Para qué fase está prevista la construcción */
  faseConstruccion: string;
  /** Icono de react-icons/lu */
  iconName: string;
  beneficios: string[];
}

export const ADDONS_CATALOG: AddonDefinition[] = [
  {
    id: 'landing_dominio',
    nombre: 'Landing pública con dominio propio',
    descripcionCorta: 'Tu propia página web con dominio personalizado',
    descripcionLarga: 'Da a tu gimnasio una presencia profesional online. Página web con tus planes, horarios, ubicación y formulario que alimenta directamente tu pipeline de prospectos. Conecta tu propio dominio (ej. evolutiongym.com) sin pagar hosting aparte.',
    precio: 199,
    planMinimo: 'basico',
    estado: 'en_desarrollo',
    faseConstruccion: 'Fase 7',
    iconName: 'LuGlobe',
    beneficios: [
      'Página web profesional editable',
      'Dominio propio incluido (.com, .mx, etc.)',
      'Formulario web alimenta prospectos automáticamente',
      'Optimizada para móvil',
      'SEO básico configurado',
    ],
  },
  {
    id: 'ia_rutinas',
    nombre: 'Rutinas inteligentes con IA',
    descripcionCorta: 'Generación automática de rutinas personalizadas',
    descripcionLarga: 'Chatbot conversacional que recolecta variables del cliente (objetivo, físico, lesiones, disponibilidad) y genera rutinas personalizadas con IA. Tus entrenadores aprueban y editan antes de entregar. Seguimiento de adherencia con datos de check-in.',
    precio: 499,
    planMinimo: 'basico',
    estado: 'en_desarrollo',
    faseConstruccion: 'Fase 8',
    iconName: 'LuSparkles',
    beneficios: [
      'Chatbot recolecta variables del cliente',
      'Rutinas generadas con IA personalizadas',
      'Aprobación de entrenadores antes de entregar',
      'Tracking de adherencia con check-ins',
      'Ajuste progresivo según resultados',
    ],
  },
  {
    id: 'chatbot_captacion',
    nombre: 'Chatbot de captación 24/7',
    descripcionCorta: 'Bot que responde y captura prospectos en WhatsApp/Web',
    descripcionLarga: 'Tu chatbot atiende clientes potenciales 24/7. Responde preguntas frecuentes (horarios, precios, ubicación), captura datos del prospecto y lo mete al pipeline automáticamente. Configurable con la información específica de tu gym.',
    precio: 399,
    planMinimo: 'pro',
    estado: 'proximamente',
    faseConstruccion: 'Post Fase 8',
    iconName: 'LuBot',
    beneficios: [
      'Atiende prospectos 24/7 sin intervención humana',
      'Responde FAQ configurables por gym',
      'Captura datos al pipeline automáticamente',
      'Funciona en WhatsApp y en tu landing web',
      'Reduce carga de recepción',
    ],
  },
  {
    id: 'portal_miembro',
    nombre: 'Portal del miembro',
    descripcionCorta: 'Auto-servicio para tus clientes',
    descripcionLarga: 'Tus miembros entran a su propio portal para ver su membresía, historial de check-ins, rutinas asignadas. Pueden renovar membresía y obtener su QR de acceso. Reduce preguntas en recepción.',
    precio: 249,
    planMinimo: 'pro',
    estado: 'proximamente',
    faseConstruccion: 'Futuro',
    iconName: 'LuUserCircle',
    beneficios: [
      'Login propio para cada miembro',
      'Ven su historial y rutina',
      'Renuevan membresía solos',
      'Reduce preguntas en recepción',
      'Branding del gym',
    ],
  },
  {
    id: 'acceso_qr',
    nombre: 'Acceso por QR / huella',
    descripcionCorta: 'Check-in automático sin recepcionista',
    descripcionLarga: 'Lector QR o biométrico en la puerta del gym. Los miembros entran solos, sin necesidad de que alguien los busque en el sistema. Hardware se vende como kit aparte o lo proporciona el gym.',
    precio: 399,
    planMinimo: 'basico',
    estado: 'proximamente',
    faseConstruccion: 'Futuro',
    iconName: 'LuQrCode',
    beneficios: [
      'Check-in 100% automático',
      'Lector QR o biométrico en puerta',
      'No requiere recepcionista para acceso',
      'Tracking real de horarios de visita',
      'Hardware disponible como kit',
    ],
  },
  {
    id: 'pasarela_pago',
    nombre: 'Pasarela de pago integrada',
    descripcionCorta: 'Cobra con tarjeta desde el sistema',
    descripcionLarga: 'Integración con MercadoPago/Stripe. Cobra con tarjeta directamente desde Caja sin terminal externa. Genera links de pago para enviar por WhatsApp a clientes que pagan a distancia. Reduce manejo de efectivo.',
    precio: 349,
    planMinimo: 'basico',
    estado: 'proximamente',
    faseConstruccion: 'Futuro',
    iconName: 'LuCreditCard',
    beneficios: [
      'Cobra con tarjeta sin terminal externa',
      'Links de pago por WhatsApp',
      'Conciliación automática',
      'Reduce manejo de efectivo',
      'MercadoPago + Stripe',
    ],
  },
  {
    id: 'creditos_cxc',
    nombre: 'Créditos y cuentas por cobrar',
    descripcionCorta: 'Para gyms que cobran a plazos',
    descripcionLarga: 'Gestión de pagos diferidos: cargos, abonos parciales, saldo pendiente por miembro. Reporte de cuentas por cobrar. Alertas de WhatsApp para liquidación de saldos.',
    precio: 299,
    planMinimo: 'pro',
    estado: 'proximamente',
    faseConstruccion: 'Cuando 2do cliente lo pida',
    iconName: 'LuReceipt',
    beneficios: [
      'Tabla de cargos y abonos por miembro',
      'Saldo pendiente visible',
      'Reporte de cuentas por cobrar',
      'Alertas WhatsApp de liquidación',
      'Historial completo de cobros parciales',
    ],
  },
];

export function getAddon(id: AddonId): AddonDefinition | undefined {
  return ADDONS_CATALOG.find((a) => a.id === id);
}

export function getAddonsDisponibles(): AddonDefinition[] {
  return ADDONS_CATALOG.filter((a) => a.estado === 'disponible');
}
```

---

## QUERIES

`lib/queries/addons.queries.ts`:

```typescript
export interface GymAddon {
  tenant_id: string;
  addon_id: string;
  estado: 'activo' | 'suspendido' | 'cancelado';
  fecha_activacion: string;
  fecha_cancelacion: string | null;
  precio_actual: number;
  notas: string | null;
}

export async function listGymAddons(tenantId: string): Promise<GymAddon[]>
export async function getGymAddon(tenantId: string, addonId: string): Promise<GymAddon | null>
export async function hasAddon(tenantId: string, addonId: string): Promise<boolean>
export async function countAddonsActivos(tenantId: string): Promise<number>
```

`hasAddon` solo retorna true si el add-on existe Y está en estado 'activo'.

---

## HELPER `hasAddon` SÍNCRONO (para usar en componentes)

Como las queries son async pero los componentes necesitan checks síncronos,
el patrón es:

1. La página del layout del tenant hace fetch de los add-ons activos
   (igual que ya hace badges)
2. Los pasa como prop a los componentes que los necesiten
3. Componentes hacen check sincronizado contra el array

Implementación:
- En `app/(tenant)/[slug]/layout.tsx`: agregar `listGymAddons(tenant.id)`
  al Promise.all
- Pasar como contexto al sidebar y otras secciones

Para componentes que ya están profundo, usar React Context:

`lib/contexts/AddonsContext.tsx`:
```typescript
'use client';
import { createContext, useContext, ReactNode } from 'react';
import type { GymAddon } from '@/lib/queries/addons.queries';

const AddonsContext = createContext<GymAddon[]>([]);

export function AddonsProvider({ children, addons }: { 
  children: ReactNode; 
  addons: GymAddon[] 
}) {
  return <AddonsContext.Provider value={addons}>{children}</AddonsContext.Provider>;
}

export function useHasAddon(addonId: string): boolean {
  const addons = useContext(AddonsContext);
  return addons.some((a) => a.addon_id === addonId && a.estado === 'activo');
}
```

Wrap el layout del tenant con `<AddonsProvider addons={addons}>`.

---

## UI — Página `/configuracion/addons`

`app/(tenant)/[slug]/configuracion/addons/page.tsx`:

Estructura visual:

```
┌─────────────────────────────────────────────┐
│ Add-ons                                      │
│ Funcionalidades extra para tu gimnasio       │
├─────────────────────────────────────────────┤
│ TUS ADD-ONS ACTIVOS (si tiene)              │
│ ┌──────────────────────────────────────┐    │
│ │ ✓ Landing Dominio  $199/mes          │    │
│ │   Activo desde 15 jun 2026           │    │
│ │   [Configurar] [Cancelar]            │    │
│ └──────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│ DISPONIBLES                                  │
│ ┌──────────────────────────────────────┐    │
│ │ 🌐 Landing Dominio Propio            │    │
│ │ Tu página web con dominio personal.  │    │
│ │ $199/mes                             │    │
│ │ [Más info] [Contratar →]             │    │
│ └──────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│ PRÓXIMAMENTE                                 │
│ ┌──────────────────────────────────────┐    │
│ │ 🤖 IA Rutinas (En desarrollo)        │    │
│ │ Rutinas generadas con IA.            │    │
│ │ $499/mes                             │    │
│ │ [Avísame cuando esté]                │    │
│ └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Componentes

`components/configuracion/AddonsManager.tsx` (client component):
- Recibe `addonsActivos: GymAddon[]` como prop
- Mapea contra `ADDONS_CATALOG` y muestra 3 secciones:
  1. Tus add-ons activos (las activaciones reales)
  2. Disponibles (estado='disponible' en catálogo, no activos)
  3. Próximamente (estado='proximamente' o 'en_desarrollo')

`components/configuracion/AddonCard.tsx`:
- Card individual de add-on con icono, nombre, precio, descripción corta
- Estado del badge según situación: activo (verde), disponible (neutral), próximamente (amarillo), en desarrollo (gris)
- Botón principal cambia según estado:
  - Activo: "Configurar" (futuro) + "Cancelar" (abre WhatsApp)
  - Disponible: "Contratar" (abre WhatsApp)
  - Próximamente: "Avísame cuando esté listo" (abre WhatsApp con mensaje específico)
- Click en card abre modal con descripción completa + lista de beneficios

`components/configuracion/AddonDetailModal.tsx`:
- Modal con info completa del add-on
- Descripción larga
- Lista de beneficios
- Precio
- Plan mínimo requerido (badge si el plan actual no califica)
- CTA principal según estado

### Mensajes a WhatsApp soporte

Centralizados en `lib/utils/whatsapp-soporte.ts`:

```typescript
import { STRING_SOPORTE_WHATSAPP } from '@/lib/constants';

export function whatsappContratarAddon(gymNombre: string, addonNombre: string, precio: number): string {
  const mensaje = `Hola, soy del gym ${gymNombre} y quiero contratar el add-on "${addonNombre}" ($${precio}/mes). ¿Cómo procedemos?`;
  return `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

export function whatsappNotificarAddon(gymNombre: string, addonNombre: string): string {
  const mensaje = `Hola, soy del gym ${gymNombre}. Por favor avísame cuando esté disponible el add-on "${addonNombre}".`;
  return `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

export function whatsappCancelarAddon(gymNombre: string, addonNombre: string): string {
  const mensaje = `Hola, soy del gym ${gymNombre} y quiero cancelar el add-on "${addonNombre}".`;
  return `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}
```

---

## INTEGRACIÓN CON CONFIGURACIÓN

Agregar tab "Add-ons" a `components/configuracion/ConfigTabs.tsx`:
- Visible para TODOS los planes (no es feature gateada, es upsell)
- Posición sugerida: después de "Mi gimnasio", antes de "Planes"

---

## ENTREGABLES

### Archivos NUEVOS

```
lib/addons.ts                                    — catálogo + tipos
lib/queries/addons.queries.ts                    — queries de gym_addons
lib/contexts/AddonsContext.tsx                   — provider + hook
lib/utils/whatsapp-soporte.ts                    — helpers de mensajes
components/configuracion/AddonsManager.tsx       — vista principal
components/configuracion/AddonCard.tsx           — card individual
components/configuracion/AddonDetailModal.tsx    — modal de detalle
app/(tenant)/[slug]/configuracion/addons/page.tsx
```

### Archivos MODIFICADOS

```
app/(tenant)/[slug]/layout.tsx                   — agregar AddonsProvider
components/configuracion/ConfigTabs.tsx          — tab "Add-ons"
lib/constants.ts                                 — confirmar SOPORTE_WHATSAPP
```

### SQL a correr en Supabase

(Bloque al inicio del documento — tabla gym_addons + índices + RLS)

---

## CRITERIOS DE ACEPTACIÓN

1. SQL ejecutado sin errores
2. Página `/configuracion/addons` carga correctamente
3. Vista muestra 3 secciones: Activos (vacío inicialmente) / Disponibles / Próximamente
4. Click en "Contratar" abre WhatsApp con mensaje prearmado
5. Modal de detalle se abre y cierra correctamente, muestra beneficios
6. Insertar manualmente en Supabase un registro en `gym_addons` (ej. landing_dominio activo) → debe aparecer en la sección "Tus add-ons activos" al recargar
7. `hasAddon('landing_dominio')` retorna true cuando hay registro activo
8. AddonsProvider provee correctamente el contexto al árbol de componentes
9. Build pasa sin errores

---

## PREGUNTAS ANTES DE EMPEZAR

Si encuentras algo que no quede claro, pregúntame. En particular:
- Si la estructura de `ConfigTabs` actual no permite agregar fácilmente otra tab
- Si el ícono LuBot/LuQrCode/LuSparkles no existen en la versión de react-icons que usa el proyecto
- Si conviene mejor que `useHasAddon` viva en otro lugar (ej. dentro de features.ts)
