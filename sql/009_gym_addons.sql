-- Fase 6.6: Infraestructura de add-ons
-- Ejecutar en Supabase SQL Editor

create table if not exists gym_addons (
  tenant_id uuid references gyms(id) not null,
  addon_id text not null,
  estado text not null default 'activo' check (estado in (
    'activo', 'suspendido', 'cancelado'
  )),
  fecha_activacion timestamptz not null default now(),
  fecha_cancelacion timestamptz,
  precio_actual numeric not null,
  notas text,
  primary key (tenant_id, addon_id)
);

create index if not exists idx_gym_addons_tenant on gym_addons(tenant_id);
create index if not exists idx_gym_addons_activo on gym_addons(tenant_id, estado)
  where estado = 'activo';

alter table gym_addons enable row level security;

create policy "tenant_isolation_gym_addons" on gym_addons
  for all using (
    tenant_id in (select id from gyms where owner_id = auth.uid())
  );
