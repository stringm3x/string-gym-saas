-- 060_miembro_referidos.sql — Tracking de quién refirió a quién
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- referido_por: opcional, apunta a otro miembro del mismo gym. Si el
-- referidor se borra (no se archiva — archivar no borra la fila), el
-- vínculo se limpia en vez de bloquear el delete.

alter table miembros
  add column if not exists referido_por uuid references miembros(id) on delete set null;

create index if not exists idx_miembros_referido_por
  on miembros(referido_por)
  where referido_por is not null;
