# Observabilidad (bloque 05)

Diseño aplicado el 2026-09-20. Referencia para releer en seis meses: por
qué existe `lib/log.ts`, qué se corrigió, y sobre todo — porque es lo más
fácil de usar mal — la diferencia entre `reset` y `unstable_retry` en los
`error.tsx` de Next 16.

## 1. El problema

El patrón se repetía en todo el sistema: las cosas fallan y nadie se
entera. Turnstile devolvía 403 sin log. El webhook de MercadoPago
respondía 200 sin procesar. `notifyWhatsapp()` era un no-op silencioso. El
enlace pago→caja hacía `return` sin log si no había caja default. Una
auditoría de `lib/queries` y `app` encontró 40 `update`/`delete`/`insert`
que no revisaban el resultado de la escritura.

## 2. `lib/log.ts`: por qué un logger mínimo y no console con convención

Antes de tocar nada se evaluó la alternativa de no crear nada nuevo y
seguir con `console.error` pero con una convención de formato. Se
descartó: sin una función que centralice el `JSON.stringify`, la
convención se olvida a la primera línea nueva — exactamente el problema
que ya existía (32 `console.error` sueltos, ninguno greppable de forma
consistente). El logger es deliberadamente mínimo, sin dependencias, sin
niveles configurables ni transporte a un servicio externo:

```ts
export function logError(tag: string, detalle: Record<string, unknown> = {}): void
export function logWarn(tag: string, detalle: Record<string, unknown> = {}): void
```

Cada llamada produce una línea JSON (`{nivel, tag, ...detalle, ts}`) vía
`console.error`/`console.warn`, greppable en los logs de Vercel por
`"tag":"nombre.del.hallazgo"`. Formaliza el patrón que ya existía en
`lib/authz/index.ts` (`console.warn(JSON.stringify({tag: "authz.denied",
...}))`) en vez de inventar uno nuevo.

`app/global-error.tsx` es la única excepción: loguea con
`console.error(JSON.stringify(...))` directo, sin importar `lib/log`,
porque es el último layout antes de que la app entera se caiga y no debe
depender de nada que también pueda fallar.

## 3. Las escrituras de dinero y vigencia

De las 40 escrituras sin revisar, las que tocan dinero o vigencia de
membresía se corrigieron primero y se cubrieron con tests (no se pueden
verificar a mano sin romper datos reales):

- `anularPago`: revertir vigencia y reabrir `planes_pago` ahora loguean si
  fallan (`pago.anular_revertir_vigencia_fallo`,
  `pago.anular_reabrir_plan_pago_fallo`), sin bloquear la anulación misma
  — el pago ya está anulado, el efecto secundario que falla queda visible.
- `congelarMembresia` / `aprobarCongelacion` / `solicitarCongelacionPortal`:
  si `extenderVencimiento` falla, ya no se inserta el evento de
  congelación como si hubiera aplicado. `descongelarMembresia` revierte
  días de forma no bloqueante pero logueada.
- `pagarCuota` (créditos): si el update a `estado: completado` del plan
  falla, se loguea (`credito.marcar_plan_completado_fallo`) pero el cobro
  de la cuota ya ocurrió y no se revierte.
- `createPlanPago` / `createAbonoMembresia` (créditos): rollback
  compartido — ver sección 5.
- `autorizarCodigo` (kiosco): revertir el claim del código — ver sección 6.
- `revertirPagoMp` (webhook MercadoPago): las tres escrituras del
  reembolso/contracargo (`pagos_externos.status`, `pagos.reembolsado_at`,
  `miembros.fecha_vencimiento`) ahora loguean cada una si falla, sin
  detener las siguientes.
- `logApiRequest`: el hallazgo que originó el barrido — ver sección 4.

## 4. El catch que no atrapa nada: `.then(() => {}, () => {})`

`logApiRequest` tenía `.then(() => {}, () => {})` creyendo que capturaba
cualquier fallo del insert. No es así: **Supabase-js nunca rechaza la
promesa por un error de base de datos** — el query builder es "thenable"
pero siempre resuelve a `{ data, error }` (o `{ count, error }`). Un
`.then(onSuccess, onError)` o un `try/catch` alrededor de una llamada a
Supabase solo atrapa una excepción real (fallo de red, código que lanza),
nunca un `{ error }` resuelto. Un catch así es peor que no tener catch:
da falsa seguridad de que el fallo se está viendo cuando no es el caso.

Se buscó el mismo patrón en todo el repo, no solo en la lista original de
40. Se encontró y corrigió en `lib/whatsapp/registro.ts`
(`registrarMensaje`, las tres escrituras: upsert y update de
`wa_conversaciones`, insert de `wa_mensajes`) — directamente relevante
porque si esa escritura falla en silencio, el mensaje nunca aparece en el
inbox aunque el cron ya lo haya marcado como enviado.

Se encontraron dos casos más que **no** se corrigieron, por ser de
impacto bajo y porque el código ya declara que el resultado no importa:

- `lib/queries/solicitudes.queries.ts`, `activarSolicitud`: el insert del
  miembro demo está en un `catch { /* best-effort */ }` cuyo propio
  comentario dice que no bloquea la activación si falla. Un catch que "no
  atrapa nada" no cambia el comportamiento cuando la intención ya era
  ignorar el resultado.
- `lib/api/auth.ts:95`: `void admin.rpc("bump_api_key_usage", ...)` — el
  `void` ya es una declaración explícita de "no me importa si falla".

## 5. `borrarPlanPagoHuerfano`: un solo rollback para créditos

Créditos ya arrastra tres bugs conocidos (cuota 1 sin cobrar al crear el
plan, `pagarCuota` no atómico, reembolso sin desmarcar cuota). El pedido
explícito fue no sumar un cuarto: planes de pago huérfanos si el rollback
de `createPlanPago`/`createAbonoMembresia` fallaba en silencio. Se
consolidó en un único helper usado por los 4 sitios de rollback (2 en
`createPlanPago`, 2 en `createAbonoMembresia`):

```ts
async function borrarPlanPagoHuerfano(supabase, tenantId, planId, motivo) {
  const { error } = await supabase.from("planes_pago").delete().eq("id", planId);
  if (error) logError("credito.rollback_plan_huerfano", { tenantId, planId, motivo, error: error.message });
}
```

Si el delete de limpieza también falla, el plan huérfano queda logueado
con el motivo original (`movimiento_stock_fallo`, `cuotas_insert_fallo`,
`cuota_1_no_encontrada`) — antes no había forma de saber que existía.

## 6. `autorizarCodigo`: revertir el claim del kiosco

El código de autorización se reclama con un update atómico
(`usado: false → true`). Si el pago falla después, `revertir()` intenta
devolver `usado: false` para que el socio pueda reintentar con el mismo
código. El problema: si el revert **también** fallaba, el staff veía el
mismo mensaje de error del pago (p. ej. "Sin stock") como si reintentar
fuera a funcionar — pero el código seguía marcado como usado y todo
reintento fallaría por eso, no por la razón mostrada.

`revertir()` ahora devuelve `boolean`. Si el revert funciona, se muestra
el error real del pago (recuperable). Si el revert también falla, se
muestra un mensaje distinto y logueado aparte
(`kiosco.revertir_codigo_fallo`):

> "No se pudo procesar el pago ni liberar este código. Pídele al socio
> que genere uno nuevo desde el kiosco."

## 7. Recibo centralizado en `createPago`

Antes solo se mandaba recibo desde el cobro rápido de caja, con el
resultado ignorado. Se centralizó en `createPago`
(`lib/queries/pagos.queries.ts`): cualquier flujo que pasa por ahí
(renovar, cuota de crédito, ticket con membresía, inscripción de
prospecto, MercadoPago) dispara `enviarReciboDePago` automáticamente. El
resultado (`reciboEnviado`/`reciboError`) se propaga hasta el
`useActionState` de cada Server Action como campos opcionales, para que
la UI pueda avisar con el nuevo toast `warning` si el correo no salió —
el cobro en sí nunca se revierte por esto, solo se hace visible.
`registrarTicket` usa una RPC separada que no pasa por `createPago`, así
que llama a `enviarReciboDePago` por su cuenta tras vincular la caja.

## 8. WhatsApp: solo se registra lo que de verdad se envió

El cron escribía "saliente" en el inbox aunque `notifyWhatsapp` hubiera
fallado — el socio veía mensajes en el historial que el cliente nunca
recibió, y el cron respondía `ok` con un contador de intentos, no de
éxitos. `runWhatsappCron()` ahora cuenta `intentos`/`enviados`/`fallidos`
por separado; `registrarMensaje` solo se llama si `notifyWhatsapp`
devolvió `true`. `app/api/cron/whatsapp/route.ts` loguea un
`whatsapp_cron.resumen_con_fallos` (warn) si `fallidos > 0`, así queda
visible sin que el cron falle como request.

## 9. `error.tsx` por segmento: `unstable_retry`, no `reset`

Next 16 cambió la firma de los props de `error.tsx`:

```ts
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void })
```

**`reset` sigue existiendo** (no fue eliminado, no da error de tipos si
se usa), pero **solo limpia el estado local del error boundary** — no
vuelve a pedir datos al servidor. Si el segmento crasheó por un fetch que
falló, `reset()` reintenta renderizar con los mismos props ya rotos y
vuelve a crashear, o peor, "se recupera" mostrando datos viejos porque el
Server Component nunca se re-ejecutó. **`unstable_retry` sí vuelve a
pedir los datos** (re-fetch + re-render del segmento en el servidor) —
es el que hay que usar para páginas RSC con datos, que es el 100% de los
`error.tsx` de este bloque. `unstable_retry` se agregó en Next 16.2.0;
confirmarlo en la tabla de Version History del doc de `error.tsx` en
`node_modules/next/dist/docs/` antes de asumir que existe en un Next más
viejo.

Dentro de seis meses, alguien va a copiar un `error.tsx` de otro proyecto
(o de memoria) con `reset` y va a "funcionar" en el sentido de que no
tira TypeError — solo que el botón "Reintentar" no va a reintentar nada.
Por eso queda documentado acá y no solo en la descripción del PR.

Otros dos detalles de la implementación real, no solo del tipo:

- `error.tsx` envuelve `page.tsx` y los `layout.tsx` anidados **por
  debajo** de su propio nivel, pero **no** envuelve el `layout.tsx` de su
  propio segmento. Por eso el sidebar/header/`ToastProvider` de
  `app/(tenant)/[slug]/layout.tsx` sobrevive a un crash en
  `app/(tenant)/[slug]/**/page.tsx` — el usuario no pierde la navegación,
  solo el contenido de la página.
- `app/global-error.tsx` reemplaza el layout raíz **completo** — debe
  definir su propio `<html>`/`<body>` y no puede depender de
  `globals.css`, fuentes custom ni componentes de la librería de UI. Se
  escribió con estilos inline a propósito, para que siga funcionando
  incluso si lo que crasheó fue algo tan básico como el layout raíz mismo.

## 10. Toast `warning`

No existía la variante `warning` del sistema de toasts, así que varios
fallos (como un recibo que no sale) solo quedaban en `console.error` sin
que nadie en la UI se enterara. Se agregó siguiendo el rediseño ya en
`main`: sin esquinas redondeadas, sin sombra, una barra de color de 4px a
la izquierda (`border-l-warning`, token `--color-warning: #f5a524`) más
ícono (`LuTriangleAlert`).

## 11. Verificación manual: cómo confirmar que un fallo ahora sí se ve

- **Recibo**: forzar que `sendRecibo` falle (p. ej. `RESEND_API_KEY`
  inválida en local) y cobrar cualquier pago → la respuesta de la Server
  Action trae `reciboError`, y en Vercel aparece una línea
  `"tag":"recibo.envio_fallido"`.
- **WhatsApp cron**: apagar el proveedor de WhatsApp (o forzar que
  `notifyWhatsapp` devuelva `false`) y correr `/api/cron/whatsapp` → la
  respuesta trae `fallidos > 0`, en Vercel aparece
  `"tag":"whatsapp_cron.resumen_con_fallos"`, y el inbox NO muestra un
  mensaje "saliente" para ese evento.
- **Kiosco atascado**: en un entorno de prueba, romper el update de
  revertir (p. ej. RLS temporal) y forzar un pago fallido → el mensaje en
  el kiosco cambia al de "código atascado", y aparece
  `"tag":"kiosco.revertir_codigo_fallo"`.
- **error.tsx**: en dev, lanzar un error a propósito dentro de un
  `page.tsx` de un segmento (`throw new Error("test")`) → aparece la
  pantalla de `ErrorScreen` de ese segmento (no la genérica de Next), el
  sidebar/header siguen ahí, "Reintentar" vuelve a pedir los datos, y en
  consola aparece `"tag":"error_boundary.<segmento>"`.
- Grep genérico para cualquier hallazgo de este bloque en Vercel:
  buscar `"nivel":"error"` y filtrar por el `tag` específico.
