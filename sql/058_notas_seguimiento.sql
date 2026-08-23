-- 058_notas_seguimiento.sql — Tareas/recordatorios de seguimiento en notas
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Hoy `notas` es solo texto libre con categoría (tipo_accion), sin fecha de
-- seguimiento ni estado. Esto agrega ambos como opcionales: una nota normal
-- sigue funcionando igual (fecha_seguimiento null), y una nota con fecha
-- aparece en "Seguimientos pendientes" hasta marcarse como completada.

alter table notas
  add column if not exists fecha_seguimiento date,
  add column if not exists completada boolean not null default false;

-- Solo se consulta el subconjunto con fecha de seguimiento pendiente; el
-- índice parcial mantiene esa consulta barata sin pesar sobre notas normales.
create index if not exists idx_notas_seguimiento
  on notas(tenant_id, fecha_seguimiento)
  where fecha_seguimiento is not null and completada = false;
