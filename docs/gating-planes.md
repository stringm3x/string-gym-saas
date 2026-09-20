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
| `color_gimnasio` | — | **Starter** (nueva) | Acento del gym hacia el socio: portal, kiosco, QR y recibo — *no* el panel del staff |
| `dashboard_simple` | Starter | Starter | Panel del mes (cifras y gráficas) |
| `personalizacion_logo` | Starter | Starter | Logo del gimnasio |
| `portal_miembro` | Escala | Escala | Portal del socio — se queda en Escala |
| `creditos` | Escala | **Pro** | Créditos y pagos a plazos, cuentas por cobrar |
| `multiusuario` | — | **Pro** (nueva) | Invitar staff adicional (Starter no puede invitar) |
| `dashboard_completo` | Pro (sin uso) | **Pro** (ahora gatea) | MRR, ARPU, LTV y rotación (`SaludNegocio`) |
| `riesgo_panel` | — | **Pro** (nueva) | Fila "socios sin actividad" en Hoy, tarjeta "Sin venir 14 días", badge de riesgo en la ficha |
| `whatsapp_manual` | — | **Pro** (nueva) | Botón "WhatsApp" de acciones rápidas y "Enviar por WhatsApp" tras un cobro |
| `reportes` | — | **Pro** (nueva) | Reporte financiero (CSV e impresión) |
| `opiniones` | Pro | **Pro** | Opiniones del socio y reseñas en Google Maps — se quedan en Pro |
| `nutricion` | Pro | **Escala** | Planes de nutrición |
| `personalizacion_colores` | Pro | **Eliminada** | Ver "Colores del gimnasio" abajo |
| Resto de Pro (inventario, promociones, clases, kiosco de autoservicio, MercadoPago, campañas, tags, notas, plantillas, acciones masivas, prospectos, API) | Pro | Pro | Sin cambio |
| `whatsapp_automatico`, `alertas_dueno` | Escala | Escala | Sin cambio |

Otros cambios de esta rama:

- **Prueba de 14 días siempre en Pro** (`activarSolicitud`), como promete la
  web. El plan de interés se conserva en la solicitud para activar el plan
  pagado correcto al terminar.
- Precios para el MRR del admin: 799 / 1,799 / 2,999 (antes 999 / 1,999 / 2,999).

**Por qué `portal_miembro` se queda en Escala.** No es técnico, es de
precio: sin `whatsapp_automatico` ni `alertas_dueno` montados aún en
producción, Escala hoy en día vende sobre todo `nutricion` — insuficiente
para un salto de $1,799 a $2,999. El portal del socio es lo único tangible
que Escala puede mostrar en una demo mientras tanto: es lo que ve el socio,
y es lo que hace lucir moderno a un gimnasio frente a su competencia.
`creditos` sí baja a Pro porque es operación (cuentas por cobrar), no un
diferenciador de marca frente al socio.

## Colores del gimnasio: hacia el socio (Starter), no hacia el panel

Decisión tomada (ya no pendiente): el color del gimnasio manda en lo que ve
su socio; el verde de STRING manda en el panel del staff.

- **`color_acento`** baja a Starter (feature `color_gimnasio`) y se respeta
  en **portal, kiosco, QR y recibo** — los cuatro sitios donde el socio ve
  al gym, no al staff. `updateMarcaAction`, `MarcaForm`/`MarcaFormClient`
  siguen editándolo desde Configuración → Marca, disponible en todos los
  planes.
- **`color_sidebar` y `color_fondo` dejaron de personalizarse**, en
  cualquier plan. Se quitaron de la pantalla de Marca (ya no hay picker de
  "menú lateral" ni "fondo del contenido", ni el selector de "temas
  rápidos" que los combinaba con el acento) y el panel del staff
  (`app/(tenant)/[slug]/layout.tsx`) ya no inyecta ningún CSS de marca: usa
  siempre los tokens STRING. Los gráficos del dashboard (`/dashboard`)
  también volvieron a verde STRING fijo, por el mismo criterio (son parte
  del panel interno).
  - **Las columnas `gyms.color_sidebar`/`gyms.color_fondo` NO se borraron**
    — siguen en la base, sin uso. Confirmado con un grep sobre todo `app/`,
    `components/` y `lib/`: ningún archivo las lee ni las escribe ya
    (antes de este cambio, su alcance ya estaba 100% contenido en
    `marca.queries.ts`, `marca.schema.ts`, el form de Marca y
    `layout.tsx` — no llegaban a portal/kiosco/QR/recibo ni a ningún otro
    lado). Quedan disponibles para una migración futura que las elimine,
    cuando se decida.
  - La feature `personalizacion_colores` quedó sin ningún uso tras este
    cambio (todo lo que gateaba se dividió entre `color_gimnasio` y "sin
    gate, siempre STRING") y se eliminó de `lib/features.ts`.

## Impacto en tenants vivos

No se aplica nada a tenants por esta rama: el gating se evalúa en cada
request según `gyms.plan`. Lo que cambia para cada plan al desplegar:

**Starter (`basico`)** — gana: Hoy, scanner y kiosco de QR, exportar CSV, y
ahora también el color de acento hacia sus socios (portal, kiosco, QR,
recibo). Pierde (si lo estaba usando sin corresponderle): invitar staff
(las cuentas ya creadas siguen entrando por RLS), reporte financiero,
MRR/ARPU/LTV, badge y fila de socios en riesgo, botones de WhatsApp a un
clic.

**Pro** — gana: créditos y cuentas por cobrar. Mantiene opiniones/Google
Maps (se quedan en Pro). Pierde: nutrición (pasa a Escala). `portal_miembro`
nunca estuvo en producción como Pro — pasó por esta rama de Escala a Pro y
de vuelta a Escala antes de mergear, así que no hay ningún Pro real que
pierda algo que ya tenía. Los datos no se tocan: si un Pro sube a Escala,
todo sigue ahí.

**Escala** — sin cambio de features (ya tenía todo lo de Pro heredado,
incluyendo `opiniones` y `portal_miembro`, que nunca dejaron de estar
disponibles ahí). Si algún Escala había guardado `color_sidebar`/
`color_fondo` personalizados, su panel interno vuelve a los colores STRING
al desplegar esta rama — el dato se queda en la columna, solo deja de
aplicarse.

### `evolution-gym` (Escala) — confirmado, afectado

Tiene guardado `color_sidebar = #171325` y `color_fondo = #100b1c`: su
panel interno vuelve a negro/verde STRING al desplegar (columnas sin
usarse, no se borran). Su `color_acento = #a855f7` (morado) se conserva
tal cual y sigue viéndose en portal, kiosco y recibo — Escala nunca perdió
`color_gimnasio` (lo hereda de Starter). Nutrición y opiniones también
siguen disponibles (Escala incluye Pro).

### `gym-demo` — pendiente de confirmar en vivo

No hay forma de confirmar su plan/colores/uso de nutrición u opiniones
desde el código — correr en Supabase (solo lectura):

```sql
select slug, plan, estado, color_acento, color_sidebar, color_fondo
from gyms where slug in ('evolution-gym', 'gym-demo');

-- Starter con staff invitado (seguirían entrando, ya no podrían invitar más):
select g.slug, count(*) filter (where s.rol <> 'owner') as staff
from gyms g join staff s on s.gym_id = g.id
where g.plan = 'basico' group by g.slug;

-- Pro/Starter usando nutrición (Escala) u opiniones (ambas se quedan/suben):
select g.slug, g.plan,
       (select count(*) from planes_nutricion p where p.tenant_id = g.id) as nutricion,
       (select count(*) from opiniones o where o.tenant_id = g.id) as opiniones
from gyms g where g.plan in ('basico', 'pro');
```

Si ambos tenants están en Escala (como se espera), ninguno pierde ninguna
feature con esta rama — Escala hereda todo lo de Pro y Starter. El único
efecto visible sería, para quien haya personalizado `color_sidebar`/
`color_fondo`, que su panel interno vuelve a los colores STRING.
