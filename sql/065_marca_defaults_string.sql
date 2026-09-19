-- 065_marca_defaults_string.sql — Defaults de marca alineados al sistema STRING
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- El código (app/globals.css y lib/validations/marca.schema.ts) ya usa los
-- tokens de marca: fondo #000000 y fondo-elevado #0f1310. Esta migración
-- alinea los defaults de columna para gyms nuevos.
--
-- El UPDATE solo toca filas que siguen con el default ANTERIOR (nunca
-- personalizaron): un gym que eligió su propio color no cambia. Afecta a
-- tenants vivos → revisar antes de correrlo:
--   select slug, color_sidebar, color_fondo from gyms;

alter table gyms
  alter column color_sidebar set default '#0f1310',
  alter column color_fondo set default '#000000';

update gyms
  set color_sidebar = '#0f1310'
  where color_sidebar = '#141414';

update gyms
  set color_fondo = '#000000'
  where color_fondo = '#0a0a0a';
