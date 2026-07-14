-- 048_cortes_caja.sql — Corte de caja / arqueo por turno (B1)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Un turno de caja: se abre con un fondo inicial en efectivo, se cobran pagos
-- durante el turno, y al cerrar se cuadra el efectivo contado contra el
-- esperado (fondo + efectivo cobrado). Los totales por método quedan snapshot.
--
-- Los pagos del turno se asocian por rango de tiempo [abierto_at, cerrado_at):
-- hay un solo corte abierto por gym a la vez (un solo cajón físico).

create table if not exists cortes_caja (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),

  fondo_inicial numeric not null default 0 check (fondo_inicial >= 0),
  abierto_por uuid,
  abierto_por_nombre text,
  abierto_at timestamptz not null default now(),

  cerrado_por uuid,
  cerrado_por_nombre text,
  cerrado_at timestamptz,

  -- Snapshot al cerrar.
  total_efectivo numeric,
  total_tarjeta numeric,
  total_transferencia numeric,
  efectivo_esperado numeric, -- fondo_inicial + total_efectivo
  efectivo_contado numeric,  -- lo que el cajero contó
  diferencia numeric,        -- contado - esperado
  notas text,

  created_at timestamptz not null default now()
);

-- Un solo corte abierto por gym a la vez.
create unique index if not exists idx_cortes_caja_abierto
  on cortes_caja(tenant_id)
  where estado = 'abierto';

-- Historial por gym, más recientes primero.
create index if not exists idx_cortes_caja_hist
  on cortes_caja(tenant_id, abierto_at desc);

alter table cortes_caja enable row level security;

create policy "cortes_caja_tenant" on cortes_caja
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
