-- Bloque 2.4: anular (cancelar) un pago registrado
-- Ejecutar en Supabase SQL Editor
--
-- anulado_at: marca un pago como anulado. Un pago anulado NO cuenta en los
-- totales de caja y su recibo público responde "anulado" (410).

alter table pagos
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_motivo text;

create index if not exists idx_pagos_anulado
  on pagos(tenant_id, anulado_at)
  where anulado_at is not null;
