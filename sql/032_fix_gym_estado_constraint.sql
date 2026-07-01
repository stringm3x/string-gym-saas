-- 032_fix_gym_estado_constraint.sql — Fix constraint de gyms.estado (Fase 7.3)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- PROBLEMA: la tabla `gyms` conserva su constraint original auto-nombrado
-- `gyms_estado_check`, que NO incluye 'prueba' (ni 'suspendido'/'cancelado').
-- La migración 022 agregó un segundo constraint `check_gym_estado` con los 4
-- valores, pero no eliminó el original, así que el más restrictivo sigue
-- vigente. Efecto: no se puede poner un gym en 'prueba' (activación de trial)
-- ni en 'suspendido'/'cancelado' (acciones del Admin) → ambos fallan.
--
-- FIX: eliminar ambos constraints por nombre y dejar UNO canónico con los 4
-- estados válidos. Idempotente.

alter table gyms drop constraint if exists gyms_estado_check;
alter table gyms drop constraint if exists check_gym_estado;

alter table gyms
  add constraint gyms_estado_check
    check (estado in ('activo', 'prueba', 'suspendido', 'cancelado'));
