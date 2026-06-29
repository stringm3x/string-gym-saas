-- 029_mercadopago.sql — Pagos externos MercadoPago (Fase 7.9, Bloque 1)
-- Modelo marketplace: cada gym conecta SU cuenta MercadoPago (OAuth) y cobra
-- a su propio nombre. STRING no toca el dinero.

-- ─────────────────────── 1. Tabla de pagos externos ───────────────────────

create table if not exists pagos_externos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  -- Se linkea al pago interno cuando el cobro se confirma (webhook).
  pago_id uuid references pagos(id) on delete set null,

  proveedor text not null default 'mercadopago',
  external_id text not null,         -- id de la preferencia/pago en MercadoPago
  status text not null,              -- pending / approved / rejected / cancelled …
  metodo text,                       -- card / oxxo (ticket) / bank_transfer (spei)
  monto numeric not null,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lookup rápido por external_id (lo usa el webhook) + por tenant.
create index if not exists idx_pagos_externos_external
  on pagos_externos(external_id);
create index if not exists idx_pagos_externos_tenant
  on pagos_externos(tenant_id, created_at desc);

create trigger pagos_externos_updated_at
  before update on pagos_externos
  for each row execute function update_updated_at();

-- ─────────────────────── 2. Credenciales MP por gym ───────────────────────
-- Tokens de la cuenta MercadoPago del gym (obtenidos vía OAuth en Bloque 2).
-- ⚠️ SENSIBLES: nunca exponer mp_access_token al cliente; el cobro y el
-- webhook los leen con service-role.

alter table gyms
  add column if not exists mp_access_token text,
  add column if not exists mp_public_key text,
  add column if not exists mp_user_id text,
  add column if not exists mp_email text;

-- ─────────────────────────────── 3. RLS ───────────────────────────────
-- Aislamiento por tenant (owner ∪ staff activo). El webhook/cobro usan
-- service-role (bypassan RLS).

alter table pagos_externos enable row level security;

create policy "tenant_access_pagos_externos"
  on pagos_externos for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
