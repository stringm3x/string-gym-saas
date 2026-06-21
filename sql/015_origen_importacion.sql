-- Fase 6.9: importación CSV de miembros
-- Ejecutar en Supabase SQL Editor
--
-- origen_importacion: rastrea miembros importados (null = creado manual,
--   'csv:2026-06-22-<id>' = importado vía CSV).
-- plan_id: plan de membresía actual del miembro (mapeado desde el CSV).

alter table miembros
  add column if not exists origen_importacion text,
  add column if not exists plan_id uuid references planes_membresia(id) on delete set null;

create index if not exists idx_miembros_plan
  on miembros(plan_id)
  where plan_id is not null;

create index if not exists idx_miembros_origen
  on miembros(tenant_id, origen_importacion)
  where origen_importacion is not null;
