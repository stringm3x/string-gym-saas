-- Bloque 9: Archivar miembros (soft delete)
-- Ejecutar en Supabase SQL Editor

alter table miembros add column if not exists archivado boolean not null default false;
alter table miembros add column if not exists archivado_at timestamptz;

create index if not exists idx_miembros_archivado on miembros(tenant_id, archivado);
