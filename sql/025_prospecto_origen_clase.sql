-- 025_prospecto_origen_clase.sql — Fase 7.10, Bloque 2
-- Permite el origen 'clase_gratis' en prospectos, para los prospectos que se
-- generan automáticamente cuando alguien reserva una clase de tipo 'gratis'.
-- El CHECK actual solo admite: landing, whatsapp, referido, manual.

alter table prospectos
  drop constraint if exists prospectos_origen_check;

alter table prospectos
  add constraint prospectos_origen_check
  check (origen in ('landing', 'whatsapp', 'referido', 'manual', 'clase_gratis'));
