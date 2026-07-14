-- 046_checkin_politica_vencidos.sql — Política de acceso ante membresía vencida
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Unifica el comportamiento del check-in (búsqueda manual, scanner QR y kiosco)
-- ante una membresía vencida: bloquear el acceso (default) o solo advertir y
-- dejar pasar. Configurable por gym desde Configuración → Gym.

alter table gyms
  add column if not exists checkin_bloquea_vencidos boolean not null default true;

comment on column gyms.checkin_bloquea_vencidos is
  'true = el check-in bloquea a miembros con membresía vencida; false = solo advierte y deja pasar.';
