-- 062_staff_pin_checkin.sql — Check-in por PIN al abrir/cerrar turno de caja
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Problema: en una tablet compartida de recepción, "quién abrió el turno"
-- depende de qué sesión de Supabase esté activa en ese aparato, no de quién
-- físicamente está en la caja. Un PIN de 4 dígitos por empleado (opcional,
-- lo asigna el owner) permite confirmar identidad sin logout/login completo.
--
-- Solo texto: pin_hash (nunca el PIN en claro, mismo patrón que el OTP del
-- portal — sha256). Los intentos fallidos bloquean temporalmente para que un
-- PIN de 4 dígitos no sea trivialmente adivinable por fuerza bruta.

alter table staff
  add column if not exists pin_hash text,
  add column if not exists pin_intentos_fallidos integer not null default 0,
  add column if not exists pin_bloqueado_hasta timestamptz;

-- Feature flag por gym: si está apagado (default), abrir/cerrar turno se
-- comporta exactamente igual que hoy (usa la sesión activa, sin pedir PIN).
alter table gyms
  add column if not exists caja_checkin_pin boolean not null default false;
