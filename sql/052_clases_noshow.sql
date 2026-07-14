-- 052_clases_noshow.sql — Penalización por no-shows en clases (C1)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Configurable por gym: tras N no-shows recientes, el socio no puede reservar
-- nuevas clases hasta que "caduquen". 0 = penalización desactivada (default).

alter table gyms
  add column if not exists clases_max_noshows integer not null default 0;

comment on column gyms.clases_max_noshows is
  'Máx. de no-shows en los últimos 30 días antes de bloquear nuevas reservas. 0 = desactivado.';
