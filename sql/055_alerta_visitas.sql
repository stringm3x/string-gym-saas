-- 055_alerta_visitas.sql — Alerta de visitas bajas por WhatsApp (D8)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Umbral configurable por gym: cuando el saldo de visitas del socio baja hasta
-- este número (tras un check-in), se le avisa por WhatsApp. 0 = desactivado.

alter table gyms
  add column if not exists alerta_visitas_umbral integer not null default 0;

comment on column gyms.alerta_visitas_umbral is
  'Avisar al socio por WhatsApp cuando sus visitas restantes lleguen a este número. 0 = desactivado.';
