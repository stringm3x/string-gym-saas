-- 068_campanas_canal.sql — Distinguir campañas enviadas por API de las
-- registradas manualmente (bloque 07).
-- ✅ APLICADA en producción — confirmado por Carlos el 2026-09-20.
--
-- Antes `enviada_at` se escribía al crear la fila, antes de intentar el
-- envío — así que una campaña quedaba "enviada" aunque el envío por API
-- fallara entero, o aunque el flujo cayera al modo manual (wa.me) y el
-- staff nunca terminara de mandar los links. Y el historial no tenía forma
-- de distinguir un envío real por la API de uno registrado a mano.
--
-- `canal` queda null hasta que se confirma el envío (API respondió, o el
-- staff terminó el flujo manual) — null en el historial significa "quedó
-- a medias", no "se perdió".

alter table campanas
  add column if not exists canal text
    check (canal in ('api', 'manual'));

comment on column campanas.canal is
  'Cómo se confirmó el envío: api (WhatsApp automático) o manual (wa.me, staff confirmó a mano). Null = quedó pendiente de confirmar.';
