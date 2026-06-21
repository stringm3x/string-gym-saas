# Funcionalidad por sección — STRING GYM SaaS

Documento de referencia interna sobre qué hace cada pantalla del sistema,
cuándo se usa y qué valor aporta al dueño/staff. Útil para onboarding de
un nuevo dev o para preparar materiales de venta.

> **Roles:** `owner` (dueño) y `receptionist` (recepcionista). El recepcionista
> opera el día a día (cobrar, registrar, check-in, vender) pero NO ve finanzas,
> configuración ni prospectos. Ver la matriz completa en `lib/permissions.ts`.
>
> **Planes:** Básico / Pro / Escala. Cada feature está gateada por plan
> (`lib/features.ts`) y, además, por rol. Los gates son dobles: cliente (UI) +
> servidor (server actions / RLS).

---

## Hoy

**Audiencia:** Owner. Requiere plan Pro+ (`pantalla_hoy`).
**Cuándo se usa:** Primera pantalla al entrar (el root redirige aquí si el plan
lo incluye). Vista rápida de "qué requiere mi atención hoy".

**Qué muestra:**
- Stats del día: check-ins, ingresos y vencimientos de hoy.
- Centro de alertas agrupado por severidad (urgente / atención / informativo).

**Valor:** El dueño no tiene que buscar qué hacer; la pantalla se lo dice.
El recepcionista no accede (lo redirige a Check-in).

---

## Dashboard

**Audiencia:** Owner (`ver_dashboard_completo`).
**Cuándo se usa:** Para revisar el estado del negocio en tiempo real.

**Qué muestra:**
- Métricas de miembros: activos, por vencer (7 días), inactivos, check-ins
  hoy, visitas hoy.
- Métricas de ingresos: hoy / semana / mes (con comparativo vs mes anterior).
- Gráfica de check-ins de los últimos 7 días.
- Lista de miembros por vencer (accionable).

**Valor:** Foto financiera y operativa del gym. Los números tienen count-up
y la UI es premium (micro-animaciones) para demos.

---

## Miembros

**Audiencia:** Owner y recepcionista (`crear_miembros`, `editar_miembros`).
Archivar/restaurar es solo owner (`eliminar_archivar_miembros`).
**Cuándo se usa:** Gestión del padrón de miembros.

**Qué hace:**
- Lista con búsqueda, filtro de **Estado** (Todos/Activos/Por vencer/
  Inactivos/Archivados), filtro por **Origen** (manual / importados CSV) y
  por **Tag** (Pro+).
- Alta/edición de miembro; al dar de alta se puede **cobrar la primera
  membresía** en el mismo flujo.
- **Tags** (Pro+): etiquetar miembros (VIP, Riesgo, etc.).
- **Bulk actions** (Pro+): WhatsApp masivo, asignar tag, exportar CSV.
- **Timeline de notas** (Pro+) o notas simples (Básico) en el detalle.
- **Acciones rápidas** (llamar / WhatsApp / email) en el detalle.
- **Archivar** (soft delete): el miembro sale de listados activos pero
  conserva su historial; restaurable. Solo owner.
- **Importar CSV** (owner): wizard de 3 pasos con preview, validación,
  detección de duplicados y mapeo de planes.

**Valor:** CRM central del gym; desde aquí se opera al cliente.

---

## Check-In

**Audiencia:** Owner y recepcionista (`ver_checkins_dia`, `hacer_checkin_manual`).
**Cuándo se usa:** Registrar la entrada de un miembro (modo kiosco o manual).

**Qué hace:**
- Búsqueda rápida del miembro (autocomplete) y registro de check-in con un clic.
- Muestra el logo del gym arriba (identidad en el kiosco).
- Feed de check-ins del día.

**Valor:** Control de asistencia; base para detectar miembros inactivos.

---

## Caja

**Audiencia:** Owner y recepcionista (`registrar_pagos`, `vender_desde_caja`).
Cancelar/anular pagos es solo owner (`cancelar_pagos`).
**Cuándo se usa:** Cobrar membresías, productos, visitas; revisar lo cobrado.

**Qué hace:**
- **Registrar cobro:** membresía (plan/promo o personalizado), producto,
  visita o concepto libre. La fecha de próximo vencimiento respeta el día de
  pago original en renovaciones (ver `lib/utils/membresia-rango.ts`).
- **Visita rápida:** cobra a un visitante sin registrarlo como miembro/prospecto.
- **Cobrado hoy:** totales día/semana/mes (filtrables por categoría) +
  movimientos del día.
- **Recibo:** cada cobro genera un recibo. Si el miembro tiene email, se le
  manda automáticamente con link al recibo público; además aparece un botón
  **"Enviar por WhatsApp"** con mensaje pre-redactado.
- **Anular pago** (owner): invalida el pago; deja de contar en totales y su
  recibo público queda inválido.

**Valor:** Punto de venta y de ingresos del gym.

---

## Inventario

**Audiencia:** Ver stock: owner y recepcionista (`ver_inventario_stock`).
Movimientos y gestión de productos: solo owner (`ver_inventario_movimientos`).
Requiere plan Pro+ (`inventario`).
**Cuándo se usa:** Administrar productos y su stock.

**Qué hace:**
- **Productos:** catálogo con stock actual, mínimo y alertas de stock bajo.
- **Movimientos:** entradas/salidas/ajustes (solo owner). Las ventas desde
  Caja descuentan stock automáticamente.

**Valor:** Control de mercancía y su impacto en caja.

---

## Prospectos

**Audiencia:** Owner (`ver_prospectos`). Requiere plan Pro+ (`prospectos`).
**Cuándo se usa:** Llevar el embudo de ventas de clientes potenciales.

**Qué hace:**
- Tablero **Kanban** por etapas (nuevo / contactado / etc.), drag & drop.
- Notas y acciones rápidas (WhatsApp/llamar) por prospecto.
- **Conversión a miembro:** desde el prospecto se crea el miembro (con cobro
  opcional) y el prospecto pasa a "convertido".

**Valor:** No se pierden leads; convierte interesados en miembros.

---

## Alertas

**Audiencia:** Owner (`ver_alertas`). Requiere plan Escala (`alertas_dueno`).
**Cuándo se usa:** Ver de un vistazo lo que requiere atención.

**Qué muestra (5 tipos predictivos):**
- Vencimientos hoy y próximos.
- Stock bajo.
- Prospectos sin contactar (>24h).
- Miembros sin actividad reciente (sin check-in en 14 días).

**Valor:** Anticipa problemas (churn, faltantes) antes de que cuesten dinero.

---

## Configuración → Marca

**Audiencia:** Owner (`configurar_general`). Logo en todos los planes;
colores solo Pro+ (`personalizacion_colores`).
**Qué hace:**
- Logo del gym (sidebar, recibos, kiosco).
- Colores personalizables (Pro+): acento, sidebar y fondo del contenido, con
  preview en vivo. Aplican al sistema interno (variables CSS).

**Valor:** El dueño ve "su gym" en pantalla; refuerza identidad en demos y uso.

---

## Configuración → Add-ons

**Audiencia:** Owner. Visible para todos los planes (es upsell).
**Qué hace:**
- Catálogo de funcionalidades extra contratables (landing con dominio,
  IA rutinas, chatbot, portal del miembro, acceso QR, pasarela de pago,
  CxC). Estado: disponible / próximamente / en desarrollo.
- CTA "Contratar" / "Avísame" abre WhatsApp de soporte STRING.

**Valor:** Vía de monetización adicional por encima del plan.

---

## Configuración → Staff

**Audiencia:** Owner (`gestionar_staff`).
**Qué hace:**
- Invitar recepcionistas por email (Supabase Auth). El invitado crea su
  contraseña en `/auth/accept-invite` y queda activo.
- Estados: invitado / activo / desactivado. Reenviar, cancelar, desactivar,
  reactivar y eliminar (no se puede tocar al owner).

**Valor:** Multiusuario real con roles — sin compartir la contraseña del dueño.

---

## Configuración → Planes

**Audiencia:** Owner (`configurar_planes_promociones`).
**Qué hace:**
- CRUD de planes de membresía (nombre, precio, días de duración, activo/inactivo).
- Los planes alimentan el cobro en Caja y el mapeo de la importación CSV.

**Valor:** Define la oferta de membresías del gym.

---

## Configuración → Promociones

**Audiencia:** Owner (`configurar_planes_promociones`).
**Qué hace:**
- CRUD de promociones de membresía y de producto (precio, vigencia, duración).
- Las promos vigentes aparecen como opción al cobrar en Caja.

**Valor:** Campañas y descuentos sin tocar los planes base.

---

## Configuración → Tags

**Audiencia:** Owner (`configurar_planes_promociones`). Feature `tags` (Pro+).
**Qué hace:**
- CRUD de etiquetas con color, con conteo de uso en miembros y prospectos.

**Caso de uso:** Segmentar — VIP, Riesgo (probable baja), Estudiante,
Referido — para filtrar listados y acciones masivas.

**Valor:** Segmentación accionable de la base de clientes.

---

## Configuración → Plantillas

**Audiencia:** Owner (`configurar_planes_promociones`). Feature
`plantillas_mensaje` (Pro+).
**Qué hace:**
- CRUD de plantillas de mensaje con variables (`{{nombre}}`,
  `{{fecha_vencimiento}}`, `{{gym_nombre}}`), por categoría.
- Se usan en las **acciones rápidas de WhatsApp** de miembros/prospectos.

**Valor:** Mensajería consistente y rápida para todo el equipo.
