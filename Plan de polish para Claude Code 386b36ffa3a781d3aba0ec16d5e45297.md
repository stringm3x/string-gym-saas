# Plan de polish para Claude Code

Plan de polish del producto antes de Fase 7. Trabajo identificado en sesión de revisión manual de Carlos (junio 2026). Documento ejecutable por Claude Code: cada bloque tiene scope claro, archivos a tocar, criterios de cierre.

**Tiempo estimado total:** 15-25 horas (3-5 sesiones de Claude Code).

**Pre-requisitos:** Confirmar Decisión A (recibo automático) y Decisión B (Caja precios/duración) antes de Bloque 2. Los Bloques 1 y 5 pueden arrancar sin esperar esas decisiones.

---

# Cómo usar este plan

Pasar a Claude Code con este prompt:

```
Lee FASE_POLISH_PLAN.md (esta página de Notion). Es el plan de polish 
post-Fase 6.9 antes de arrancar Fase 7.

ESTRATEGIA:
- Trabaja bloque por bloque en el orden propuesto
- Cada bloque = 1 commit como mínimo
- npm run build limpio antes de cada commit
- Reporta cambios sin commitear antes de cada commit
- Las decisiones marcadas como [PENDIENTE] no se ejecutan hasta que 
  Carlos confirme

ARRANCA con Bloque 1 (bugs críticos). No esperes confirmación para esos.
```

Claude Code lee el documento completo, prioriza según orden, y reporta para validar antes de cada commit.

---

# Bloque 1 — Bugs críticos (3-4h)

Claude Code puede arrancar este bloque sin esperar decisiones. Son bugs reportados por Carlos en uso del producto.

## 1.1 Fix gráfica de check-ins en Dashboard

**Problema:** Carlos reportó que la gráfica de check-ins no funciona.

**Pasos:**

1. Reproducir el bug primero (login como owner gym-demo, ir a Dashboard)
2. Identificar si es problema de:
    - Query a BD (datos no llegan)
    - Componente SVG (no renderiza)
    - Datos en formato incorrecto (parsing falla)
3. Documentar la causa raíz
4. Aplicar fix
5. Verificar con datos de prueba que la gráfica muestra check-ins correctamente

**Archivos probables:**

- `components/dashboard/CheckinChart.tsx` (o similar)
- `lib/queries/dashboard.queries.ts`
- `app/(tenant)/[slug]/dashboard/page.tsx`

**Criterio de cierre:** La gráfica muestra los check-ins del mes actual correctamente con datos reales del demo.

**Commit:** `fix(dashboard): gráfica de check-ins no renderiza`

## 1.2 Limpiar filtros duplicados en Miembros

**Problema:** Carlos reportó que hay filtros que se repiten visualmente en la lista de miembros.

**Pasos:**

1. Hacer screenshot de `/miembros` actual
2. Identificar exactamente qué filtros se duplican (probable: estado de membresía, fecha vencimiento, archivado)
3. Auditar `MiembrosToolbar.tsx` y componentes hijos
4. Consolidar filtros similares en uno solo con opciones múltiples
5. Mantener toda la funcionalidad pero con UI limpia

**Archivos probables:**

- `components/miembros/MiembrosToolbar.tsx`
- `components/miembros/MiembrosFilters.tsx` (si existe)
- `lib/queries/miembros.queries.ts` (param types)

**Criterio de cierre:** No hay filtros duplicados. Toolbar se ve limpio. Todos los casos de uso siguen funcionando.

**Commit:** `refactor(miembros): consolidar filtros duplicados`

## 1.3 Separar "pagos" de "para pagar" en Caja

**Problema:** Carlos reportó que los filtros entre "pagos hechos" y "para pagar" se confunden porque se repiten visualmente.

**Pasos:**

1. Revisar la pantalla de Caja actual
2. Decidir entre 2 opciones de UX:
    - **Opción A:** Tabs claras arriba ("Cobrar" / "Historial")
    - **Opción B:** Secciones diferenciadas con headers y colores diferentes
3. Implementar la opción elegida (Claude Code decide la mejor)
4. Aplicar separación visual entre "acción de cobrar" e "historial de cobros"

**Archivos probables:**

- `app/(tenant)/[slug]/caja/page.tsx`
- `components/caja/CajaToolbar.tsx`
- `components/caja/HistorialPagos.tsx`

**Criterio de cierre:** Las dos secciones se distinguen visualmente al primer vistazo. Filtros no se repiten entre secciones.

**Commit:** `style(caja): separar visualmente cobrar de historial`

---

# Bloque 2 — Lógica de negocio (5-7h)

Requiere decisiones blindadas. Algunas ya las tomamos, otras pendientes.

## 2.1 Día de pago fijo vs flexible (D1 — DECIDIDA)

**Decisión Carlos:** Respetar día de pago original aunque el cliente pague tarde, excepto en reactivación o nuevo ingreso.

**Lógica:**

| Caso | Cálculo de próxima fecha |
| --- | --- |
| Renovación normal (miembro activo paga antes de vencer) | Suma duración al `fecha_vencimiento` original (respeta día) |
| Renovación tardía (miembro activo o próximo a vencer paga después) | Suma duración al `fecha_vencimiento` original (respeta día) |
| Reactivación (miembro inactivo/vencido más de X días paga) | Suma duración a HOY (resetea día) |
| Nuevo miembro | Suma duración a HOY (establece día) |

**Caso edge:** Si el día de vencimiento original es 31 y el mes siguiente solo tiene 30, usar último día del mes (30).

**Pasos:**

1. Identificar función actual `calcularFechaVencimiento()` o equivalente
2. Agregar parámetro `tipoOperacion: 'renovacion' | 'reactivacion' | 'nuevo'`
3. Implementar la lógica de los 4 casos
4. Agregar tests unitarios para los casos edge
5. Documentar la lógica con comentario en código

**Decisión adicional:** Definir el umbral de "reactivación". Sugerencia: si `fecha_vencimiento < HOY - 30 días`, es reactivación. Si está vencido pero menos de 30 días, es renovación tardía.

**Archivos probables:**

- `lib/utils/fechas.ts` o `lib/utils/membresia.ts`
- `app/(tenant)/[slug]/caja/actions.ts` (donde se procesa el pago)
- `lib/queries/pagos.queries.ts`

**Criterio de cierre:** Los 4 casos funcionan correctamente. Tests unitarios pasan. UI muestra fecha de próximo vencimiento correcta antes de confirmar pago.

**Commit:** `feat(pagos): respetar día de pago original en renovaciones`

## 2.2 Visita rápida sin registro (D2 — DECIDIDA)

**Decisión Carlos:** Crear opción de "visita rápida" que no requiere registrar al visitante como miembro o prospecto.

**Implementación:**

**SQL migration:**

```sql
-- sql/016_visitas_rapidas.sql
alter table pagos
  add column if not exists nombre_visitante text,
  add column if not exists telefono_visitante text,
  add column if not exists es_visita_rapida boolean default false;

create index if not exists idx_pagos_visitas 
  on pagos(tenant_id, es_visita_rapida) 
  where es_visita_rapida = true;
```

**UI:**

- En la pantalla de Caja, agregar botón secundario "Visita rápida"
- Click abre modal con: nombre (requerido), teléfono (opcional), monto (requerido), método de pago
- Al confirmar: crea registro en `pagos` con `es_visita_rapida = true` y campos del visitante
- NO crea miembro ni prospecto
- Aparece en historial de pagos con badge "Visita"

**Reporting:**

- Dashboard incluye "Visitas rápidas hoy" como nueva métrica
- Historial de pagos filtrable por "Solo visitas"

**Archivos:**

- `sql/016_visitas_rapidas.sql` (NUEVO)
- `components/caja/VisitaRapidaModal.tsx` (NUEVO)
- `app/(tenant)/[slug]/caja/page.tsx` (agregar botón)
- `app/(tenant)/[slug]/caja/actions.ts` (nueva action `registrarVisitaRapida`)
- `components/dashboard/StatsCards.tsx` (nueva card de visitas)

**Criterio de cierre:** Botón "Visita rápida" funcional. Pagos aparecen en historial. Dashboard muestra métrica de visitas.

**Commit:** `feat(caja): visita rápida sin registro de miembro`

## 2.3 Caja: ocultar "Personalizar precio y duración" por defecto (D4 — DECIDIDA)

**Decisión Carlos:** Mantener la funcionalidad pero esconderla detrás de un toggle. Actualmente el panel está expandido al cargar la pantalla de Caja, ocupa mucho espacio y se siente redundante. Es funcionalidad útil ocasionalmente pero no debe dominar la UI.

**Comportamiento esperado:**

- Al cargar la pantalla de Caja: el botón "Personalizar precio y duración" aparece **colapsado** (solo el botón, sin el panel expandido debajo)
- Click en el botón: expande el panel con opciones de Duración (1 semana / 15 días / 1 mes / 3 meses / 6 meses / 1 año / Fechas manuales) + Monto custom + Vigencia calculada
- Click de nuevo: colapsa
- **Estado por defecto:** colapsado. Solo se expande si el operador lo necesita.
- Si está colapsado al confirmar el pago: usa los valores predeterminados del plan/promoción seleccionado
- Si está expandido y modificado: usa los valores personalizados

**Visual:**

- Botón con borde rojo (como en screenshot actual de Carlos)
- Icono `chevron-down` al lado del texto cuando está colapsado
- Icono `chevron-up` cuando está expandido
- Transición suave de expandir/colapsar con Framer Motion (~200ms)

**Archivos probables:**

- Componente que renderiza el panel actual de personalización (buscar en `components/caja/`)
- `app/(tenant)/[slug]/caja/page.tsx`
- Convertir el panel en un componente colapsable con `useState` interno

**Criterio de cierre:** Al cargar `/caja`, el panel de personalización NO está visible. Solo el botón. Click lo expande. Funcionalidad sigue 100% disponible para quien la necesite.

**Commit:** `style(caja): colapsar panel de personalización por defecto`

## 2.4 Recibo automático por email + botón WhatsApp (DECIDIDA)

**Decisión Carlos:** Implementar las 3 capas de envío de recibo.

### Capa 1 — Email automático vía Resend (se implementa ahora)

- Trigger: cuando se crea un pago Y el miembro tiene email registrado
- Resend envía email con PDF del recibo como adjunto
- Template del email en español con branding del gym (logo + colores si Pro+)
- Subject: `Tu recibo del [Nombre del Gym] - $[Monto]`
- Body: resumen del pago + mensaje de agradecimiento + adjunto PDF
- Si el miembro NO tiene email: silently skip (no error, solo no se envía)

### Capa 2 — Botón manual WhatsApp (se implementa ahora si no existe)

- Después de confirmar el pago, mostrar botón "Enviar por WhatsApp"
- Click abre `wa.me/{telefono}?text={mensaje}` en nueva ventana
- Mensaje pre-redactado: `¡Hola {nombre}! Tu pago de ${monto} fue registrado correctamente. Tu próxima fecha de vencimiento es {fecha}. ¡Gracias!`
- Si el miembro NO tiene teléfono: botón no aparece

### Capa 3 — WhatsApp automático (NO se implementa ahora, queda para Fase 7.5)

- Cuando n8n + 360dialog estén listos en Fase 7.5
- Trigger automático desde el pago al webhook de n8n
- n8n envía WhatsApp con plantilla aprobada por Meta
- Sin tocar código del polish actual (queda preparado para integración futura)

**SQL:** ninguna migración nueva. Resend ya está configurado en Fase 6.8.

**Archivos probables:**

- `lib/email/templates/recibo.tsx` (NUEVO) — template del email con branding
- `lib/email/send-recibo.ts` (NUEVO) — helper para enviar vía Resend
- `app/(tenant)/[slug]/caja/actions.ts` — invocar envío después de crear pago
- Componente de confirmación de pago — agregar botón WhatsApp manual
- `lib/utils/whatsapp.ts` — helper para construir [wa.me](http://wa.me) URL con mensaje

**Criterio de cierre:**

- Pago de miembro con email → email automático con PDF llega a su inbox
- Pago de miembro sin email → no falla, solo no envía email
- Pago de miembro con teléfono → botón WhatsApp visible
- Click en botón WhatsApp → abre WhatsApp con mensaje pre-redactado correcto

**Tiempo estimado:** 2-3h

**Commit:** `feat(recibos): envío automático por email + botón WhatsApp manual`

---

# Bloque 3 — Mejoras UX/UI (5-8h)

## 3.1 Dashboard más vistoso y lujoso

**Objetivo:** El dashboard es la primera pantalla que ve el dueño cada día. Tiene que verse premium para sorprender al cliente en demos.

**Inspiración:** Linear, Vercel, Stripe dashboards. Lo opuesto a paneles de admin típicos (planos, tablas rígidas).

**Pasos:**

1. Cards con micro-animaciones de hover (subtle lift + glow del color brand)
2. Números grandes con count-up animation (ya existe en algunos, replicar pattern)
3. Gradientes sutiles en backgrounds de cards principales
4. Comparativo visual mes vs mes (arrow up/down + porcentaje con color)
5. Mejor jerarquía tipográfica (números XL en Anton, labels en Geist)
6. Espaciado más generoso
7. Animación stagger al entrar a la página (cards aparecen una tras otra)

**Archivos probables:**

- `app/(tenant)/[slug]/dashboard/page.tsx`
- `components/dashboard/StatsCards.tsx`
- `components/dashboard/RevenueChart.tsx`
- `components/dashboard/CheckinChart.tsx`
- Usar Framer Motion (ya instalado)

**Criterio de cierre:** El dashboard se ve premium al primer vistazo. Carlos hace screenshot y le da WOW.

**Commit:** `style(dashboard): visual premium con micro-animaciones`

## 3.2 Marca: cambiar fondo del contenido

**Objetivo:** Hoy en `/configuracion/marca` solo se puede cambiar color acento + color sidebar. Agregar tercera variable: color de fondo del contenido principal.

**SQL migration:**

```sql
-- sql/017_color_fondo.sql
alter table gyms
  add column if not exists color_fondo text default '#0a0a0a';
```

**UI:**

- En `/configuracion/marca`, agregar tercer color picker
- Variable CSS `--color-bg-content` aplicada en layout
- Solo Plan Pro+ (gate doble cliente + servidor)
- Preview en tiempo real (ya existe pattern)

**Archivos:**

- `sql/017_color_fondo.sql` (NUEVO)
- `components/configuracion/MarcaForm.tsx`
- `components/configuracion/MarcaPreview.tsx`
- `app/(tenant)/[slug]/layout.tsx` (inyectar variable CSS)
- `lib/queries/marca.queries.ts`
- `app/(tenant)/[slug]/configuracion/marca/actions.ts`

**Criterio de cierre:** Color de fondo personalizable funciona. Preview muestra cambios en tiempo real. Solo Pro+ puede editarlo.

**Commit:** `feat(marca): personalización de color de fondo del contenido`

---

# Bloque 4 — Documentación funcional (2-3h)

## 4.1 Documentar para qué sirve cada sección

**Objetivo:** Carlos reportó dudas sobre el propósito de algunas pantallas (Hoy, Prospectos, Alertas, Tags). Crear documento de referencia interna.

**Crear archivo:** `docs/funcionalidad-por-seccion.md` en el repo.

**Estructura sugerida:**

```markdown
# Funcionalidad por sección — STRING GYM SaaS

Documento de referencia interna sobre qué hace cada pantalla del sistema, 
cuándo se usa, y qué valor aporta al dueño/staff.

## Hoy

**Audiencia:** Owner (solo).
**Cuándo se usa:** Como primera pantalla al login. Vista rápida de "qué 
requiere mi atención hoy".

**Qué muestra:**
- Vencimientos hoy y los próximos 3 días
- Check-ins del día (número + lista rápida)
- Alertas activas (si Plan Escala)
- Acciones rápidas sugeridas ("contactar a 5 miembros por vencer")

**Valor:** El dueño no tiene que buscar qué hacer. La pantalla le dice.

## Dashboard
[similar formato]

## Miembros
[similar formato]

... etc para todas las secciones
```

**Secciones a documentar:**

1. Hoy
2. Dashboard
3. Miembros (incluye bulk actions y tags)
4. Check-In (kiosko vs manual)
5. Caja (pagos, productos, visitas rápidas)
6. Inventario (stock vs movimientos)
7. Prospectos (kanban, conversión a miembro)
8. Alertas (5 tipos predictivos — Plan Escala)
9. Configuración → Marca
10. Configuración → Add-ons
11. Configuración → Staff (sistema multiusuario)
12. Configuración → Planes (CRUD de membresías)
13. Configuración → Promociones
14. Configuración → Tags (caso de uso: VIP, Riesgo, Estudiante)
15. Configuración → Plantillas (mensajes con variables)

**Criterio de cierre:** Archivo creado con todas las 15 secciones documentadas. Util para onboarding de nuevo dev o para preparar materiales de venta.

**Commit:** `docs: funcionalidad por sección del sistema`

---

# Bloque 5 — Audit positivo (1h)

Validación rápida de que estas secciones siguen funcionando bien:

## Tests funcionales manuales

- [ ]  **Staff (Fase 6.8):** Crear nuevo recepcionista, recibir email, aceptar invite, login funcional, sidebar reducido
- [ ]  **Planes:** Crear nuevo plan de membresía, editar, desactivar
- [ ]  **Promociones:** Crear promoción nueva, aplicarla en caja
- [ ]  **Plantillas:** Crear plantilla con variables, usarla en acción rápida WhatsApp

Si algo no funciona en estas áreas, reportarlo y agregar al Bloque 1 como nuevo bug.

**Criterio de cierre:** Las 4 secciones funcionan correctamente.

---

# Orden de ataque

```
DIA 1 (3-4h):
  Bloque 1.1 — Fix gráfica check-ins
  Bloque 1.2 — Filtros duplicados miembros
  Bloque 1.3 — Separar caja
  Bloque 5   — Audit positivo

DIA 2 (4-6h) — esperar confirmaciones de Carlos:
  Bloque 2.1 — Día de pago fijo
  Bloque 2.2 — Visita rápida
  Bloque 2.3 — Si Carlos confirma
  Bloque 2.4 — Si Carlos confirma

DIA 3 (4-6h):
  Bloque 3.1 — Dashboard premium
  Bloque 3.2 — Color fondo personalizable

DIA 4 (2-3h):
  Bloque 4   — Documentación
```

---

# Convenciones

- **Build limpio antes de cada commit.** `npm run build` debe pasar.
- **Commits granulares:** uno por sub-bloque (1.1, 1.2, etc.) idealmente.
- **Prefijos correctos:**
    - `fix:` para bugs
    - `style:` para cambios visuales sin lógica
    - `refactor:` para limpieza sin cambiar funcionalidad
    - `feat:` para nuevas features
    - `docs:` para documentación
- **Reportar cambios antes de commitear** — Carlos valida y da luz verde.
- **No tocar:** Staff, Planes, Promociones, Plantillas (a menos que Bloque 5 detecte bug).

---

# Criterios de cierre del polish

- [ ]  Los 3 bugs críticos resueltos y validados manualmente
- [ ]  Lógica de día de pago implementada con tests
- [ ]  Visita rápida funcional end-to-end
- [ ]  Dashboard se ve premium (criterio: Carlos hace screenshot)
- [ ]  Color de fondo personalizable funciona
- [ ]  Documentación por sección creada
- [ ]  Build limpio en `main`
- [ ]  Tests funcionales de Staff/Planes/Promociones/Plantillas pasan
- [ ]  Decisión A y B resueltas e implementadas

Cuando todo esté:

- Reporte de revisión por sección actualizado con ✅ en cada punto
- Push a `origin/main`
- Listo para arrancar Fase 7 (Landing pública)

---

# Decisiones pendientes

✅ **TODAS DECIDIDAS.** El plan está 100% ejecutable.

- **Decisión A** (recibo automático) → Opción 4: email auto + botón WhatsApp manual + automático en Fase 7.5
- **Decisión B** (Caja precios/duración) → Colapsar panel por defecto con toggle, mantener funcionalidad

Claude Code puede arrancar por cualquier bloque sin esperar nada.