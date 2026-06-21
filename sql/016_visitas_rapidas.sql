-- Bloque 2.2: visitas rápidas (cobro sin registrar miembro/prospecto)
-- Ejecutar en Supabase SQL Editor

alter table pagos
  add column if not exists nombre_visitante text,
  add column if not exists telefono_visitante text,
  add column if not exists es_visita_rapida boolean not null default false;

create index if not exists idx_pagos_visitas
  on pagos(tenant_id, es_visita_rapida)
  where es_visita_rapida = true;
