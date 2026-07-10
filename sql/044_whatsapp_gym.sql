-- 044_whatsapp_gym.sql — Credenciales de WhatsApp por gym (Fase 7.5)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- El motor de WhatsApp (lib/whatsapp/notify.ts → n8n → 360dialog) está DORMIDO
-- hasta que exista la infra. Cada gym Escala tiene su propio número y subcuenta
-- de 360dialog; Carlos los conecta en el onboarding (~15 min).
--
-- - whatsapp_numero:  número del gym en formato E.164 (+521XXXXXXXXXX)
-- - whatsapp_api_key: API key de su subcuenta 360dialog
-- - whatsapp_activo:  interruptor por gym (además del feature 'whatsapp_automatico')

alter table gyms
  add column if not exists whatsapp_numero text,
  add column if not exists whatsapp_api_key text,
  add column if not exists whatsapp_activo boolean not null default false;
