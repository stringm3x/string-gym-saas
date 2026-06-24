-- 027_prospecto_origen_api.sql — API Pública (Fase 7.11, Bloque 2)
-- Permite el origen 'api' en prospectos: los que llegan desde el endpoint
-- POST /api/v1/[slug]/prospectos (formularios de webs externas).
-- CHECK actual (tras 025): landing, whatsapp, referido, manual, clase_gratis.

alter table prospectos
  drop constraint if exists prospectos_origen_check;

alter table prospectos
  add constraint prospectos_origen_check
  check (origen in (
    'landing', 'whatsapp', 'referido', 'manual', 'clase_gratis', 'api'
  ));
