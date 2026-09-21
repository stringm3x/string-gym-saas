-- 069_gym_estado_previo.sql — PROPUESTA (Bloque 10, PR 2)
-- ⚠️ NO APLICADA. Se corre manualmente cuando se valide.
--
-- Guarda el estado del gym justo antes de suspenderlo/cancelarlo, para que
-- "Reactivar" restaure ese estado en vez de asumir siempre "activo" (un gym
-- que estaba en prueba no debe reactivarse como si fuera plan pagado).

alter table gyms
  add column if not exists estado_previo text;

-- Backfill de las filas YA suspendidas/canceladas antes de esta migración:
-- no hay forma de saber su estado real anterior, así que se infiere por
-- prueba_hasta (solo los tenants de prueba lo tienen seteado).
update gyms
  set estado_previo = case when prueba_hasta is not null then 'prueba' else 'activo' end
  where estado in ('suspendido', 'cancelado') and estado_previo is null;
