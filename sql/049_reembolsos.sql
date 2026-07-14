-- 049_reembolsos.sql — Reembolsos como documento de primera clase (B2a)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Anular != reembolsar. Anular marca un pago como no-válido (error de captura).
-- Reembolsar registra que se DEVOLVIÓ dinero (o se emitió nota de crédito) por
-- un pago que sí ocurrió, con su propio rastro contable.

alter table pagos
  add column if not exists reembolsado_at timestamptz,
  add column if not exists reembolsado_motivo text;

create table if not exists reembolsos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  pago_id uuid not null references pagos(id) on delete cascade,
  miembro_id uuid references miembros(id) on delete set null,
  monto numeric not null check (monto > 0),
  motivo text,
  -- Método de devolución. 'nota_credito' = saldo a favor (no sale efectivo).
  tipo text not null
    check (tipo in ('efectivo', 'tarjeta', 'transferencia', 'nota_credito')),
  creado_por uuid,
  creado_por_nombre text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reembolsos_tenant
  on reembolsos(tenant_id, created_at desc);
create index if not exists idx_reembolsos_pago on reembolsos(pago_id);

alter table reembolsos enable row level security;

create policy "reembolsos_tenant" on reembolsos
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
