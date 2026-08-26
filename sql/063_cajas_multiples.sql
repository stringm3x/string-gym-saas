-- 063_cajas_multiples.sql — Varias cajas/puntos de venta por gym (Recepción,
-- Aguas, Tienda…), cada una con su propio turno y su propio cuadre.
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Hoy solo puede haber UN turno abierto por gym a la vez. Esto separa el
-- concepto de "turno" del de "gym": ahora un turno pertenece a una caja, y
-- puede haber varias cajas abiertas al mismo tiempo (una persona en
-- Recepción, otra en Aguas), cada una cuadrando su propio efectivo.
--
-- No se toca la tabla `pagos` ni el RPC que la llena (registrar_pago /
-- registrar_ticket) — la versión exacta que corre en producción no está
-- confirmada, y modificarla mal rompería TODOS los cobros. En vez de eso,
-- `pagos_caja` enlaza cada pago a una caja desde TypeScript, justo después
-- de que el RPC ya lo creó.

-- ───────────────────────── 1. Tabla cajas ─────────────────────────

create table if not exists cajas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  nombre text not null,
  -- La caja a la que se asignan los pagos que no vienen de la página de
  -- Caja (portal, kiosco, MercadoPago, cuotas de crédito…) — no tienen un
  -- "punto de venta" físico real, pero necesitan caer en algún lado.
  es_default boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- Una sola caja default por gym.
create unique index if not exists idx_cajas_default
  on cajas(tenant_id)
  where es_default = true;

create index if not exists idx_cajas_tenant on cajas(tenant_id, activa);

alter table cajas enable row level security;

create policy "cajas_tenant" on cajas
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

-- Backfill: una caja "Recepción" (default) por cada gym existente, para que
-- nada se rompa — el comportamiento de hoy sigue siendo "una sola caja".
insert into cajas (tenant_id, nombre, es_default)
select id, 'Recepción', true
from gyms g
where not exists (select 1 from cajas c where c.tenant_id = g.id);

-- ───────────────────────── 2. cortes_caja → caja_id ─────────────────────────

alter table cortes_caja
  add column if not exists caja_id uuid references cajas(id) on delete restrict;

update cortes_caja cc
set caja_id = (select id from cajas c where c.tenant_id = cc.tenant_id and c.es_default = true)
where caja_id is null;

alter table cortes_caja
  alter column caja_id set not null;

-- Reemplaza el índice viejo ("un turno abierto por gym") por uno por caja
-- ("un turno abierto por caja") — así Recepción y Aguas pueden estar
-- abiertas al mismo tiempo, cada una independiente.
drop index if exists idx_cortes_caja_abierto;

create unique index if not exists idx_cortes_caja_abierto_por_caja
  on cortes_caja(caja_id)
  where estado = 'abierto';

create index if not exists idx_cortes_caja_por_caja
  on cortes_caja(caja_id, abierto_at desc);

-- ───────────────────────── 3. pagos_caja (enlace pago → caja) ─────────────────────────

create table if not exists pagos_caja (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  pago_id uuid not null,
  caja_id uuid not null references cajas(id) on delete restrict,
  created_at timestamptz not null default now(),

  unique (pago_id)
);

create index if not exists idx_pagos_caja_caja on pagos_caja(caja_id, created_at);
create index if not exists idx_pagos_caja_tenant on pagos_caja(tenant_id);

alter table pagos_caja enable row level security;

create policy "pagos_caja_tenant" on pagos_caja
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
