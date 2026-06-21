-- Bloque 2.4: token público para recibos (link en email)
-- Ejecutar en Supabase SQL Editor
--
-- token_publico permite acceder al recibo HTML sin login desde el email.
-- Backfill opcional (solo aplica a pagos nuevos; los viejos no tienen token).

alter table pagos
  add column if not exists token_publico text unique;

create index if not exists idx_pagos_token
  on pagos(token_publico)
  where token_publico is not null;
