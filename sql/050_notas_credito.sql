-- 050_notas_credito.sql — Notas de crédito / saldo a favor (B2b)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Alternativa al reembolso en efectivo: en vez de devolver dinero, se emite un
-- saldo a favor del miembro (nota de crédito) que aplica a una próxima compra.
-- Una nota nace de un reembolso con tipo 'nota_credito' y se consume (FIFO) al
-- cobrar.

create table if not exists notas_credito (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  origen_reembolso_id uuid references reembolsos(id) on delete set null,
  monto numeric not null check (monto > 0),  -- valor original emitido
  saldo numeric not null check (saldo >= 0), -- restante por usar
  estado text not null default 'activa'
    check (estado in ('activa', 'usada', 'cancelada')),
  created_at timestamptz not null default now()
);

-- Saldo disponible por miembro (notas activas, más viejas primero para FIFO).
create index if not exists idx_notas_credito_saldo
  on notas_credito(tenant_id, miembro_id, estado, created_at);

alter table notas_credito enable row level security;

create policy "notas_credito_tenant" on notas_credito
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

-- Cuánto crédito se aplicó a cada pago (para el desglose del recibo).
alter table pagos
  add column if not exists credito_aplicado numeric not null default 0;
