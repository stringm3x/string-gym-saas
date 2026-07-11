# Workflows de n8n — WhatsApp automático (Fase 7.5)

JSONs exportables para importar en n8n cuando se active la infra (VPS + n8n +
360dialog). Mientras `N8N_WEBHOOK_URL` no esté configurada en la app, el motor
(`lib/whatsapp/notify.ts`) es un no-op silencioso y estos workflows no reciben
nada.

## Workflows incluidos

| Archivo | Evento (`tipo`) | Plantilla Meta | Destino | Params (orden) |
|---|---|---|---|---|
| `01-recordatorio-vencimiento.json` | `MEMBRESIA_POR_VENCER` | `recordatorio_vencimiento` | miembro | miembroNombre, diasRestantes, gymNombre |
| `02-membresia-vencida.json` | `MEMBRESIA_VENCIDA` | `membresia_vencida` | miembro | miembroNombre, gymNombre |
| `03-prospecto-nuevo.json` | `PROSPECTO_NUEVO` | `prospecto_nuevo_owner` | owner | prospectoNombre, prospectoTelefono, planInteres |
| `04-resumen-diario.json` | `RESUMEN_DIARIO` | `resumen_diario_owner` | owner | gymNombre, checkinshoy, ingresosHoy, vencimientosEstaSemana |
| `05-miembro-inactivo.json` | `MIEMBRO_SIN_ACTIVIDAD` | `miembro_inactivo_owner` | owner | miembroNombre, diasSinVenir, gymNombre |

Cada workflow: **Webhook (POST)** → **HTTP Request a 360dialog** → **Respond 200**.
La `D360-API-KEY` se toma del **propio evento** (`body.whatsappApiKey`, la subcuenta
del gym), así que un mismo workflow sirve para todos los gyms.

## 1) Importar en n8n

1. n8n → **Workflows** → **Import from File** (o **⋯ → Import from File**).
2. Selecciona el `.json`. Repite para los 5.
3. Cada workflow queda **inactivo** (`active: false`): revísalo y actívalo cuando
   la cuenta de 360dialog esté lista.

## 2) Variables de entorno

**En la app (Vercel):**
- `N8N_WEBHOOK_URL` — URL del webhook de entrada de n8n (ver §4 sobre el
  dispatcher). Mientras no exista, todo es no-op.
- `CRON_SECRET` — protege `/api/cron/whatsapp` (recordatorios/resumen diarios).
- `CARLOS_WHATSAPP` — (opcional) teléfono de Carlos para las alertas de
  solicitudes web.

**En n8n:** no hacen falta variables extra: la API key de 360dialog viaja en cada
evento (`body.whatsappApiKey`). Si prefieres centralizarla, puedes reemplazar el
header por una credencial/variable de n8n.

## 3) Conectar con 360dialog

- Cada gym Escala tiene su **subcuenta** de 360dialog; su `whatsapp_api_key` se
  guarda en `gyms` (SQL 044) y viaja en el evento.
- Las **plantillas** (`recordatorio_vencimiento`, etc.) deben existir **aprobadas
  en Meta** con los placeholders `{{1}}, {{2}}, …` **en el orden de la tabla de
  arriba**. Ese orden es el contrato: lo respetan tanto estos workflows (Modo A)
  como el envío directo (`lib/whatsapp/n8n-handler.ts`, Modo B).
- El endpoint es `POST https://waba.360dialog.io/v1/messages` con header
  `D360-API-KEY`.

## 4) ⚠️ Arquitectura: un solo webhook de entrada

`notify.ts` postea **todos** los eventos a **una sola** `N8N_WEBHOOK_URL`. Estos
5 workflows tienen cada uno su propio path. Para producción hay dos opciones:

- **Recomendado — dispatcher:** un workflow con un **Webhook** (el que apunta
  `N8N_WEBHOOK_URL`) + un nodo **Switch** sobre `{{$json.body.tipo}}` que llama al
  workflow correcto (nodo *Execute Workflow*) o replica el HTTP a 360dialog por
  rama. Así un solo endpoint enruta los 7 tipos.
- **Pruebas — directo:** apunta `N8N_WEBHOOK_URL` al path de UN workflow para
  probar ese tipo de evento aislado.

## 5) Cómo probar un workflow

Con el workflow activo, haz un POST a su webhook con un `body` de ejemplo:

```bash
curl -X POST "https://TU-N8N/webhook/wa-recordatorio-vencimiento" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "MEMBRESIA_POR_VENCER",
    "gymId": "…", "gymSlug": "demo", "gymNombre": "Gym Demo",
    "whatsappNumero": "+521555…", "whatsappApiKey": "TU_D360_KEY",
    "miembroNombre": "Ana", "miembroTelefono": "+52155…",
    "diasRestantes": 7, "fechaVencimiento": "2026-07-15"
  }'
```

Deberías recibir el mensaje de plantilla en el WhatsApp destino y `200 OK`.

## 6) Notas / pendientes

- **`PAGO_REGISTRADO` y `BIENVENIDA_MIEMBRO` no tienen workflow aquí.** Hoy
  funcionan solo en **Modo B** (envío directo desde la app). Si quieres cubrirlos
  en Modo A, agrega 2 workflows análogos (plantillas `pago_confirmado` y
  `bienvenida_miembro`).
- **`MIEMBRO_SIN_ACTIVIDAD` va al owner** (plantilla `*_owner`): el evento trae
  el nombre del miembro para que el owner decida si lo contacta.
- Los eventos al owner (prospecto/resumen/inactivo) salen del **número del gym**
  (`whatsappApiKey`), no de un número de STRING — así el owner reconoce el
  remitente.
