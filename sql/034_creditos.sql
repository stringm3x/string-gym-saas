-- 034_creditos.sql — Créditos / Cuentas por Cobrar (Fase 7.7)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- Pagos a plazos: un miembro paga una membresía en N cuotas. La membresía se
-- activa desde el primer pago; cada cuota vencida alimenta el reporte de CxC.

-- ─────────────────────────── planes_pago ───────────────────────────
create table if not exists planes_pago (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  total numeric not null check (total >= 0),
  cuotas integer not null check (cuotas between 2 and 12),
  concepto text,
  estado text not null default 'activo'
    check (estado in ('activo', 'completado', 'cancelado')),
  created_at timestamptz not null default now()
);

-- ─────────────────────────── cuotas_pago ───────────────────────────
create table if not exists cuotas_pago (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes_pago(id) on delete cascade,
  tenant_id uuid not null references gyms(id) on delete cascade,
  numero_cuota integer not null check (numero_cuota >= 1),
  monto numeric not null check (monto >= 0),
  fecha_vencimiento date not null,
  pagado_at timestamptz,
  pago_id uuid references pagos(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────── índices ───────────────────────────
create index if not exists idx_planes_pago_tenant_estado
  on planes_pago(tenant_id, estado);

create index if not exists idx_cuotas_pago_plan_numero
  on cuotas_pago(plan_id, numero_cuota);

-- CxC por vencer: cuotas sin pagar del tenant ordenadas por vencimiento.
create index if not exists idx_cuotas_pago_cxc
  on cuotas_pago(tenant_id, fecha_vencimiento, pagado_at);

-- ─────────────────────────── RLS ───────────────────────────
alter table planes_pago enable row level security;
alter table cuotas_pago enable row level security;

-- Aislamiento por tenant (owner ∪ staff activo) vía user_gym_ids().
create policy "planes_pago_tenant" on planes_pago
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

create policy "cuotas_pago_tenant" on cuotas_pago
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
