-- 039_saldo_miembro.sql — Saldo a favor / crédito de productos (Fase P.3)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- Saldo del miembro con el gym: recargas (depósitos), consumos (compras) y
-- ajustes manuales. `saldo_miembro` guarda el saldo actual (una fila por
-- miembro); `movimientos_saldo` es el historial (libro mayor). Un saldo
-- negativo = deuda del miembro con el gym.

-- ─────────────── saldo_miembro (saldo actual) ───────────────
create table if not exists saldo_miembro (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  saldo_actual numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (tenant_id, miembro_id)
);

alter table saldo_miembro enable row level security;
create policy "saldo_miembro_tenant" on saldo_miembro
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

-- ─────────────── movimientos_saldo (historial) ───────────────
create table if not exists movimientos_saldo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  tipo text not null check (tipo in ('recarga', 'consumo', 'ajuste')),
  -- Positivo = entrada de saldo; negativo = salida.
  monto numeric not null,
  concepto text,
  -- pago_id o venta_id relacionado, si aplica.
  referencia_id uuid,
  creada_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Historial por miembro, más reciente primero.
create index if not exists idx_movimientos_saldo_miembro
  on movimientos_saldo(tenant_id, miembro_id, created_at desc);

alter table movimientos_saldo enable row level security;
create policy "movimientos_saldo_tenant" on movimientos_saldo
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
