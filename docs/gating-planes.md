# Gating por plan — Starter / Pro / Escala

Fuente única de verdad: `lib/features.ts`. Este documento explica qué
cambió respecto al mapa anterior (Básico/Pro/Escala) y qué tenants se ven
afectados. Alineado al KB Maestro STRING (sept 2026, Parte 4) y a
stringwebs.com/saas.

Los identificadores internos NO cambian (`basico`, `pro`, `escala`): viven
en `gyms.plan`, en el CHECK de `solicitudes_prueba.plan_interes` y en el
formulario de alta de la web. Solo cambia la etiqueta: `basico` → "Starter".

## Mapa final

| Feature | Antes | Ahora | Qué gatea |
|---|---|---|---|
| `qr_access` | Pro | **Starter** | Scanner de QR del staff, kiosco de entrada, QR del socio |
| `pantalla_hoy` | Pro | **Starter** | Panel del día (`/hoy`) |
| `exportacion_datos` | — | **Starter** (nueva) | Botón "Exportar CSV" en la lista de miembros |
| `dashboard_simple` | Starter | Starter | Panel del mes (cifras y gráficas) |
| `personalizacion_logo` | Starter | Starter | Logo del gimnasio |
| `portal_miembro` | Escala | **Pro** | Portal del socio |
| `creditos` | Escala | **Pro** | Créditos y pagos a plazos, cuentas por cobrar |
| `multiusuario` | — | **Pro** (nueva) | Invitar staff; Starter = 1 usuario |
| `dashboard_completo` | Pro (sin uso) | **Pro** (ahora gatea) | MRR, ARPU, LTV y rotación (`SaludNegocio`) |
| `riesgo_panel` | — | **Pro** (nueva) | Fila "socios sin actividad" en Hoy, tarjeta "Sin venir 14 días", badge de riesgo en la ficha |
| `whatsapp_manual` | — | **Pro** (nueva) | Botón "WhatsApp" de acciones rápidas y "Enviar por WhatsApp" tras un cobro |
| `reportes` | — | **Pro** (nueva) | Reporte financiero (CSV e impresión) |
| `opiniones` | Pro | **Escala** | Opiniones del socio y reseñas en Google Maps |
| `nutricion` | Pro | **Escala** | Planes de nutrición |
| Resto de Pro (inventario, promociones, clases, kiosco de autoservicio, MercadoPago, campañas, tags, notas, plantillas, acciones masivas, prospectos, API, colores) | Pro | Pro | Sin cambio |
| `whatsapp_automatico`, `alertas_dueno` | Escala | Escala | Sin cambio |

Sin feature porque **no existen en el código**: sucursales (1 / hasta 3),
landing con dominio propio, calendario de vencimientos, personalización
avanzada, soporte por niveles. No aparecen en ninguna pantalla.

Otros cambios de esta rama:

- **Prueba de 14 días siempre en Pro** (`activarSolicitud`), como promete la
  web. El plan de interés se conserva en la solicitud para activar el plan
  pagado correcto al terminar.
- **Colores del gimnasio (Pro) también se respetan hacia el socio**: portal,
  kiosco y QR público solo aplican `color_acento` si el plan tiene
  `personalizacion_colores`. Antes lo aplicaban sin mirar el plan.
- Precios para el MRR del admin: 799 / 1,799 / 2,999 (antes 999 / 1,999 / 2,999).

## Decisión pendiente: color del gimnasio en Starter

Con el KB al pie de la letra, un gimnasio Starter muestra el verde STRING a
sus propios socios en kiosco, portal y QR. Propuesta para decidir (no
implementada): partir `personalizacion_colores` en dos — `color_gimnasio`
(Starter: acento hacia el socio en portal, kiosco, QR y recibo) y
`personalizacion_colores` (Pro: colores del panel). Es un cambio de dos
líneas en `features.ts` más el gate de tres archivos.

## Impacto en tenants vivos

No se aplica nada a tenants por esta rama: el gating se evalúa en cada
request según `gyms.plan`. Lo que cambia para cada plan al desplegar:

**Starter (`basico`)** — gana: Hoy, scanner y kiosco de QR, exportar CSV.
Pierde (si lo estaba usando sin corresponderle): invitar staff (las cuentas
ya creadas siguen entrando por RLS), reporte financiero, MRR/ARPU/LTV,
badge y fila de socios en riesgo, botones de WhatsApp a un clic.

**Pro** — gana: portal del socio, créditos y cuentas por cobrar. Pierde:
opiniones/Google Maps y nutrición (pasan a Escala). Los datos no se tocan:
si vuelven a Escala, todo sigue ahí.

**Escala** — sin cambios.

Para saber a quién le pega, correr en Supabase (solo lectura):

```sql
select slug, plan, estado from gyms order by created_at;
-- Starter con staff invitado (seguirían entrando, ya no podrían invitar más):
select g.slug, count(*) filter (where s.rol <> 'owner') as staff
from gyms g join staff s on s.gym_id = g.id
where g.plan = 'basico' group by g.slug;
-- Pro usando nutrición u opiniones (pasan a Escala):
select g.slug, (select count(*) from planes_nutricion p where p.tenant_id = g.id) as nutricion,
       (select count(*) from opiniones o where o.tenant_id = g.id) as opiniones
from gyms g where g.plan = 'pro';
```

Si `evolution-gym` o `gym-demo` están en `pro` y usan nutrición u opiniones,
o están en `basico` con staff, hay que decidir antes del merge: subirlos de
plan desde el admin o aceptar que pierden esa sección.
