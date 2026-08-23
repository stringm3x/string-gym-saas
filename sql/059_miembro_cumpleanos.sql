-- 059_miembro_cumpleanos.sql — Fecha de nacimiento (para felicitación automática)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Opcional en el alta/edición del miembro. El cron diario de WhatsApp
-- (lib/whatsapp/cron.ts) la usa para mandar un mensaje de cumpleaños —
-- requiere además crear y aprobar la plantilla "cumpleanos_miembro" en
-- Meta/360dialog antes de que ese envío haga algo (ver lib/whatsapp/360dialog.ts).

alter table miembros
  add column if not exists fecha_nacimiento date;
