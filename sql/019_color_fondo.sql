-- Bloque 3.2: color de fondo del contenido personalizable (Pro+)
-- Ejecutar en Supabase SQL Editor

alter table gyms
  add column if not exists color_fondo text default '#0a0a0a';

alter table gyms
  add constraint check_color_fondo_hex
    check (color_fondo is null or color_fondo ~ '^#[0-9a-fA-F]{6}$');
