-- 043_codigos_autorizacion.sql — Kiosco de autoservicio (Fase P.2b)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- El miembro arma una compra o renovación en el kiosco (autoservicio) y el
-- sistema genera un código de 4 dígitos. El staff autoriza en el mostrador
-- capturando ese código; ahí se procesa el cobro y se marca como usado.
--
-- payload jsonb guarda el detalle según `tipo`:
--   compra    → { "items": [{ "producto_id": "...", "cantidad": 2, "precio": 50 }], "total": 100 }
--   membresia → { "plan_id": "...", "meses": 1, "total": 500 }

create table if not exists codigos_autorizacion (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  codigo char(4) not null,
  tipo text not null check (tipo in ('compra', 'membresia')),
  payload jsonb not null default '{}'::jsonb,
  miembro_id uuid references miembros(id) on delete set null,
  usado boolean not null default false,
  expira_at timestamptz not null default now() + interval '5 minutes',
  created_at timestamptz not null default now()
);

-- Lookup rápido al autorizar (buscar por código sin usar en el gym).
create index if not exists idx_codigos_autorizacion_lookup
  on codigos_autorizacion(tenant_id, codigo, usado);

-- Evita dos códigos vigentes con los mismos 4 dígitos en el mismo gym
-- (autorización ambigua). La app reintenta la generación si choca.
create unique index if not exists uq_codigos_autorizacion_activo
  on codigos_autorizacion(tenant_id, codigo)
  where usado = false;

alter table codigos_autorizacion enable row level security;

-- El staff autenticado lee/actualiza los códigos de su gym al autorizar.
-- El kiosco (contexto público, sin Supabase Auth) los crea vía service-role.
create policy "codigos_autorizacion_tenant" on codigos_autorizacion
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
