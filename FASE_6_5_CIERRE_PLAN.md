# Fase 6.5 — Cierre (Bloques 8, 9, 10)

> Plan de implementación para Claude Code. Continúa desde el Bloque 7
> (Recibos) ya completado. Lee este documento completo antes de empezar.

---

## Contexto

Bloques 1-7 de Fase 6.5 ya están terminados y funcionando: tags, timeline
de notas, plantillas de mensaje, acciones rápidas, selección múltiple +
bulk actions, pantalla "Hoy" y recibos de pago.

Falta cerrar la fase con 3 bloques:
- **Bloque 8** — Aplicar FeatureGates por plan (reparto definitivo)
- **Bloque 9** — Archivar miembros (soft delete)
- **Bloque 10** — Pagar al momento de inscribir miembro

---

## BLOQUE 8 — Aplicar FeatureGates por plan

### Reparto final de features

```typescript
// lib/features.ts

export const planFeatures = {
  basico: [
    'miembros',
    'checkins',
    'caja_basica',
    'dashboard_simple',
    'catalogo_planes',
    'recibos',
    'acciones_rapidas',        // WhatsApp manual cliente por cliente
    'archivar_miembros',
    'pagar_al_inscribir',
  ],
  pro: [
    // Hereda todo lo de básico, más:
    'inventario',
    'promociones',
    'prospectos',
    'tags',
    'timeline_notas',
    'plantillas_mensaje',
    'bulk_actions',
    'pantalla_hoy',
    'dashboard_completo',
  ],
  escala: [
    // Hereda todo lo de pro, más:
    'alertas_dueno',
    'whatsapp_automatico',     // futuro Fase 7.5
    'reportes_avanzados',      // futuro
  ],
} as const;
```

### Helper `hasFeature` con herencia

```typescript
export type Plan = 'basico' | 'pro' | 'escala';
export type Feature = (typeof planFeatures)[Plan][number];

const planHierarchy: Plan[] = ['basico', 'pro', 'escala'];

export function hasFeature(plan: Plan, feature: Feature): boolean {
  const index = planHierarchy.indexOf(plan);
  if (index === -1) return false;
  // Verifica el plan actual y todos los inferiores
  for (let i = 0; i <= index; i++) {
    const p = planHierarchy[i];
    if ((planFeatures[p] as readonly string[]).includes(feature)) {
      return true;
    }
  }
  return false;
}
```

### Aplicación de FeatureGates

**1. Sidebar — solo mostrar links según features:**

`components/layout/Sidebar.tsx` ya tiene la lógica de `hasFeature`. Solo
hay que verificar que cada link tiene la feature correcta:

- Hoy → `hasFeature(plan, 'pantalla_hoy')` (solo Pro+)
- Dashboard → siempre visible
- Miembros → siempre visible (es básico)
- Check-ins → siempre visible
- Caja → siempre visible
- Inventario → `hasFeature(plan, 'inventario')` (solo Pro+)
- Prospectos → `hasFeature(plan, 'prospectos')` (solo Pro+)
- Alertas → `hasFeature(plan, 'alertas_dueno')` (solo Escala)
- Configuración → siempre visible

**2. Configuración — tabs según plan:**

`components/configuracion/ConfigTabs.tsx`:
- Planes → siempre (básico)
- Promociones → `hasFeature(plan, 'promociones')` (Pro+)
- Tags → `hasFeature(plan, 'tags')` (Pro+)
- Plantillas → `hasFeature(plan, 'plantillas_mensaje')` (Pro+)
- Mi gimnasio → siempre (datos para recibos)

**3. Acciones dentro de páginas:**

En `MiembrosToolbar`:
- Botón "WhatsApp masivo" en bulk → solo si `hasFeature(plan, 'bulk_actions')`
- Botón "Asignar tag bulk" → solo si `hasFeature(plan, 'tags')`
- Filtro por tag → solo si `hasFeature(plan, 'tags')`
- Botón exportar CSV → solo si `hasFeature(plan, 'bulk_actions')`

En `MiembroForm` y `MiembroDetail`:
- TagSelector → solo si `hasFeature(plan, 'tags')`
- NotasTimeline → solo si `hasFeature(plan, 'timeline_notas')`
- AccionesRapidas → siempre visible (es básico). Pero el dropdown
  de plantillas solo aparece si `hasFeature(plan, 'plantillas_mensaje')`.
  Si no, el botón WhatsApp abre `wa.me/{tel}` sin mensaje pre-armado.

En `ProspectoCard` y `ProspectoModal`:
- TagSelector → solo si `hasFeature(plan, 'tags')`

En página `/inventario`:
- Si no tiene `hasFeature(plan, 'inventario')`, redirigir a página de
  upgrade con CTA "Mejorar a Plan Pro"

En página `/prospectos`:
- Si no tiene `hasFeature(plan, 'prospectos')`, redirigir a upgrade

En página `/alertas`:
- Si no tiene `hasFeature(plan, 'alertas_dueno')`, redirigir a upgrade

En página `/hoy`:
- Si no tiene `hasFeature(plan, 'pantalla_hoy')`, redirigir a `/dashboard`
  silenciosamente (no mostrar upgrade, solo cambiar la home)

### Componente reutilizable de upgrade

`components/ui/UpgradePage.tsx`:
- Recibe `feature: string`, `planRequerido: 'pro' | 'escala'`
- Renderiza pantalla atractiva: ícono + título + descripción +
  comparativa de beneficios + CTA "Mejorar a Plan X" + botón "Volver"
- El CTA por ahora abre WhatsApp del soporte STRING (no hay pasarela
  de pago todavía)

### Cómo probar el reparto

Después de implementar, ir a Supabase y cambiar `plan` del gym-demo
en la tabla `gyms`:
- `plan = 'basico'` → verificar que solo se ve lo de Plan Básico
- `plan = 'pro'` → verificar que se ve Básico + Pro
- `plan = 'escala'` → todo visible

---

## BLOQUE 9 — Archivar miembros (soft delete)

### SQL en Supabase

```sql
alter table miembros add column archivado boolean not null default false;
alter table miembros add column archivado_at timestamptz;

create index idx_miembros_archivado on miembros(tenant_id, archivado);
```

### Queries

`lib/queries/miembros.queries.ts` (modificar):

- `listMiembros(tenantId, options)`:
  - Agregar parámetro `incluirArchivados?: boolean` (default `false`)
  - Por default: filtra `where archivado = false`
  - Si `incluirArchivados=true`: muestra todos
  - Si `options.soloArchivados=true`: filtra `where archivado = true`

- Nueva: `archivarMiembro(tenantId, miembroId)`:
  - Update `archivado=true, archivado_at=now()`
  - Devuelve `{ ok: true }` o error

- Nueva: `restaurarMiembro(tenantId, miembroId)`:
  - Update `archivado=false, archivado_at=null`

- `getMiembrosStats`: solo cuenta no-archivados (los archivados no
  cuentan como "activos" ni "inactivos")

- `countMiembrosVencenHoy`: ignora archivados

- `getAlertas`: ignora archivados en todas las alertas

### Server Actions

`app/(tenant)/[slug]/miembros/actions.ts`:

```typescript
export async function archivarMiembroAction(id: string): Promise<ActionResult>
export async function restaurarMiembroAction(id: string): Promise<ActionResult>
```

Ambas revalidan `/${slug}/miembros` y `/${slug}/miembros/${id}`.

### UI

**En detalle de miembro:**
- Botón "Archivar" en el header (con icono `LuArchive`)
- Modal de confirmación: "¿Archivar a [nombre]? Sus datos y pagos se
  conservarán, pero no aparecerá en listados activos. Podrás
  restaurarlo después."
- Solo visible si miembro NO está archivado

**Si el miembro YA está archivado:**
- Banner amarillo arriba: "Este miembro está archivado desde
  [fecha_archivado_at]"
- Botón "Restaurar miembro" en el banner
- Las acciones rápidas (Llamar, WhatsApp) siguen disponibles
- Las acciones de check-in y registrar pago aparecen disabled con
  tooltip "Restaurar para realizar acciones"

**En toolbar de lista de miembros (`MiembrosToolbar.tsx`):**
- Agregar filtro adicional "Estado" con opciones:
  - Activos (por default)
  - Archivados
- Query param `?archivado=true`
- Cuando se ven archivados, las cards tienen opacidad reducida y
  badge "Archivado"

**En MiembroForm:**
- Si el miembro está archivado, el form aparece disabled con mensaje
  "Restaura este miembro para editarlo"

### Comportamiento

- Un miembro archivado:
  - NO aparece en filtros normales (activos, inactivos, por vencer)
  - NO aparece en autocomplete de check-in
  - NO aparece en autocomplete de caja
  - NO suma en stats del dashboard ni en alertas
  - SÍ aparece en historial cuando se buscan archivados específicamente
  - SUS pagos históricos siguen contando en totales de caja (es dinero
    real que el gym facturó)
  - SUS check-ins históricos siguen en sus reportes

---

## BLOQUE 10 — Pagar al momento de inscribir

### Concepto

El form de alta de miembro tiene una sección final opcional para
cobrar la primera membresía. Si el operador la activa, al guardar:
1. Se crea el miembro
2. Se registra el pago vinculado
3. Se actualiza la fecha de vencimiento del miembro
4. Se redirige a la pantalla del recibo (o se muestra toast con CTA)

### Validaciones nuevas

`lib/validations/miembro.schema.ts` (extender):

```typescript
export const miembroConPagoSchema = miembroSchema.extend({
  cobrar_inscripcion: z.boolean().optional(),
  plan_id: z.string().uuid().optional().or(z.literal('')),
  promocion_id: z.string().uuid().optional().or(z.literal('')),
  monto_pago: z.number().nonnegative().optional(),
  metodo_pago: z.enum(['efectivo', 'tarjeta', 'transferencia']).optional(),
  periodo_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  periodo_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
}).refine((data) => {
  if (data.cobrar_inscripcion) {
    return data.monto_pago && data.monto_pago > 0 && data.metodo_pago;
  }
  return true;
}, {
  message: 'Define monto y método de pago',
  path: ['monto_pago'],
});
```

### Server Action

`app/(tenant)/[slug]/miembros/actions.ts` (modificar `createMiembroAction`):

Pseudocódigo:
```typescript
const parsed = miembroConPagoSchema.safeParse(raw);
if (!parsed.success) { /* errores */ }

// 1. Crear miembro
const miembroResult = await createMiembro(tenantId, miembroData);
if (!miembroResult.ok) return error;

// 2. Si cobrar_inscripcion, registrar pago
let pagoId: string | undefined;
if (parsed.data.cobrar_inscripcion) {
  const pagoResult = await createPago(tenantId, {
    miembro_id: miembroResult.id,
    concepto: 'membresia',
    monto: parsed.data.monto_pago,
    metodo_pago: parsed.data.metodo_pago,
    periodo_inicio: parsed.data.periodo_inicio,
    periodo_fin: parsed.data.periodo_fin,
    plan_id: parsed.data.plan_id,
    promocion_id: parsed.data.promocion_id,
  });
  if (pagoResult.ok) pagoId = pagoResult.id;
}

// 3. Si venía de prospecto, marcar como convertido
if (formData.get('prospecto_id')) {
  await updateEstadoProspecto(tenantId, prospectoId, 'convertido');
}

revalidatePath(/* rutas */);

return { ok: true, miembroId: miembroResult.id, pagoId };
```

El tipo de retorno se extiende para incluir `pagoId`:
```typescript
{ ok: boolean; error: string | null; fieldErrors: ...; miembroId?: string; pagoId?: string }
```

### UI — Sección de cobro en MiembroForm

En el form de alta (NO en edición), agregar al final una sección
colapsable:

```
┌────────────────────────────────────────────┐
│ ☐ Cobrar primera membresía                 │
└────────────────────────────────────────────┘
```

Cuando se activa el toggle, se expande mostrando los mismos
componentes que usa `PagoForm` para concepto = "Membresía":

- Selector de plan o promoción (cards visibles, reutiliza
  `PlanPromoSelector`)
- Botón "Personalizar" si no quiere usar plan predefinido
- Si custom: presets de duración + input de monto + fechas
- Selector de método de pago (3 botones: efectivo, tarjeta, transferencia)
- Resumen: "Total a cobrar: $XXX"

**Componente nuevo:** `components/miembros/CobroInscripcion.tsx`
- Recibe planes y promociones como props
- Estado interno coordinado
- Pasa los datos al form padre vía hidden inputs

**Después de guardar exitosamente:**
- Si se cobró: redirigir a `/[slug]/recibos/{pagoId}` (o toast con CTA
  "Ver recibo")
- Si no se cobró: redirigir a `/[slug]/miembros/{miembroId}` como
  normal

### Integración con prospecto_id

El form de alta acepta `?prospecto_id=X` desde Fase 6. Cuando se cobra
al inscribir, el flujo natural es:
1. Drag en Kanban a "Convertido"
2. Form prellenado con datos del prospecto + banner verde
3. Operador activa "Cobrar primera membresía" y elige plan
4. Click "Guardar y cobrar"
5. Se crea miembro + se cobra + prospecto pasa a convertido + se
   muestra recibo

Este es el flujo dorado del producto — el momento "wow" de la
demostración.

---

## ENTREGABLES

### Archivos NUEVOS
- `components/ui/UpgradePage.tsx`
- `components/miembros/CobroInscripcion.tsx`
- Migración SQL para `archivado` en miembros (Bloque 9)

### Archivos MODIFICADOS
- `lib/features.ts` — reparto final + helper con herencia
- `components/layout/Sidebar.tsx` — verificar features de cada link
- `components/configuracion/ConfigTabs.tsx` — tabs según features
- `components/miembros/MiembrosToolbar.tsx`:
  - Filtro Archivados
  - Botones bulk según feature
  - Filtro por tag según feature
- `components/miembros/MiembroForm.tsx`:
  - TagSelector condicionado
  - Sección CobroInscripcion (solo modo crear)
- `components/miembros/MiembroDetail.tsx` (donde sea):
  - Botón Archivar/Restaurar
  - Banner si está archivado
  - Acciones condicionadas
- `components/prospectos/ProspectoCard.tsx` y `ProspectoModal.tsx`:
  - TagSelector condicionado
- `components/ui/AccionesRapidas.tsx`:
  - Selector de plantillas solo si feature 'plantillas_mensaje'
- `lib/queries/miembros.queries.ts`:
  - Soporte para archivados en listMiembros y stats
  - archivarMiembro, restaurarMiembro
- `lib/queries/alertas.queries.ts`:
  - Ignorar archivados
- `lib/queries/dashboard.queries.ts`:
  - Ignorar archivados
- `app/(tenant)/[slug]/miembros/actions.ts`:
  - archivarMiembroAction, restaurarMiembroAction
  - createMiembroAction extendida con cobro inline
- `lib/validations/miembro.schema.ts`:
  - miembroConPagoSchema
- Páginas que deben aplicar UpgradeGate:
  - `app/(tenant)/[slug]/inventario/layout.tsx`
  - `app/(tenant)/[slug]/prospectos/page.tsx`
  - `app/(tenant)/[slug]/alertas/page.tsx`
  - `app/(tenant)/[slug]/hoy/page.tsx` (redirige a dashboard si no tiene)
  - Tabs de configuración (Promociones, Tags, Plantillas)

### SQL a correr en Supabase (Bloque 9)

```sql
alter table miembros add column archivado boolean not null default false;
alter table miembros add column archivado_at timestamptz;

create index idx_miembros_archivado on miembros(tenant_id, archivado);
```

---

## CRITERIOS DE ACEPTACIÓN

### Bloque 8
1. Cambiar plan del gym-demo a 'basico' en Supabase → solo se ve
   miembros, check-ins, caja básica, dashboard, configuración
2. Inventario/Prospectos/Alertas/Hoy NO aparecen en sidebar
3. Configuración solo tiene tab Planes y Mi gimnasio (no Tags/Plantillas/Promociones)
4. Cambiar plan a 'pro' → aparecen Inventario, Prospectos, Hoy, todos
   los tabs de configuración EXCEPTO Alertas
5. Cambiar plan a 'escala' → aparece también Alertas
6. Entrar manualmente a `/[slug]/inventario` con plan básico → pantalla
   de upgrade
7. WhatsApp en AccionesRapidas funciona en básico (abre wa.me sin
   plantilla), en pro+ muestra dropdown de plantillas

### Bloque 9
8. Click "Archivar" en miembro → modal confirma → miembro queda archivado
9. Miembro archivado NO aparece en lista de miembros activos
10. Filtro "Archivados" en toolbar muestra solo archivados
11. Stats de dashboard NO cuentan archivados
12. Alertas NO mencionan archivados
13. Click "Restaurar" → miembro vuelve a aparecer normal
14. Búsqueda en check-in NO encuentra archivados
15. Búsqueda en caja NO encuentra archivados

### Bloque 10
16. Form de alta tiene sección "Cobrar primera membresía" (solo en crear)
17. Activar toggle expande selector de plan + método pago
18. Seleccionar plan prellena monto y vigencia
19. Guardar con cobro activado → se crea miembro + se registra pago
20. Después del guardado, redirige a recibo
21. Si venía de prospecto_id, también lo marca como convertido
22. Si NO se activa el toggle, flujo de alta funciona como siempre

### General
23. `npm run build` pasa sin errores
24. Probar los 3 planes manualmente cambiando en Supabase

---

## PREGUNTAS ANTES DE EMPEZAR

Si encuentras conflictos con código existente, pregúntame antes de
implementar. En particular:
- Si `MiembrosToolbar` ya tiene estructura compleja por bloques anteriores
- Si `createMiembroAction` ya retorna algo distinto a lo asumido
- Si el botón "Archivar" se confunde con otra acción ya existente
