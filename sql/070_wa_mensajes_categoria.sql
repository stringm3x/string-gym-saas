-- 070_wa_mensajes_categoria.sql — PROPUESTA
-- ⚠️ NO APLICADA. Se corre manualmente y se confirma antes de dar el PR
-- por cerrado (ver feedback-migraciones-confirmar-antes-de-cerrar).
--
-- Requiere que sql/045_whatsapp_inbox.sql ya esté aplicada (crea
-- wa_mensajes y wa_conversaciones). Si no se ha corrido, esta falla.

-- 1. Categoría de Meta (para el futuro contador de cupo, que todavía no se
--    construye) y nombre de la plantilla usada cuando el mensaje va por
--    plantilla. Ninguna de las dos existía como columna.
alter table wa_mensajes
  add column if not exists categoria text
    check (categoria in ('utility', 'marketing', 'authentication', 'service')),
  add column if not exists nombre_plantilla text;

-- 2. Destinatario: distingue un aviso al dueño de una conversación de
--    socio SIN comparar teléfonos — comparar por teléfono rompe cuando el
--    dueño también es socio de su propio gimnasio (caso real: Evolution).
--    Default 'socio' porque hoy todo lo que hay en la tabla es de un
--    socio; los tres avisos al dueño (prospecto nuevo, miembro sin
--    actividad, resumen diario) empiezan a escribirse con 'dueno' a
--    partir de este PR.
alter table wa_mensajes
  add column if not exists destinatario text not null default 'socio'
    check (destinatario in ('socio', 'dueno'));

-- 3. conversacion_id deja de ser obligatorio: un aviso al dueño no es una
--    conversación con ningún socio, así que no crea fila en
--    wa_conversaciones — se inserta con conversacion_id NULL. Verificado
--    contra lib/queries/inbox.queries.ts: las tres lecturas de wa_mensajes
--    siempre filtran por conversacion_id (`.eq` puntual o `.in` sobre ids
--    de wa_conversaciones ya traídas) — una fila con conversacion_id NULL
--    nunca hace match en ninguno de esos filtros, así que nunca puede
--    aparecer en el inbox. No hace falta tocar esas queries.
alter table wa_mensajes
  alter column conversacion_id drop not null;
