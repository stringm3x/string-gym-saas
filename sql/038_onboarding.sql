-- 038_onboarding.sql — Guía de primer acceso (Fase P.1)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- Marca si el owner ya completó (o saltó) la guía de inicio. El layout del
-- tenant redirige al owner a /onboarding mientras esté en false.

alter table gyms
  add column if not exists onboarding_completado boolean not null default false;
