-- 030_solicitudes_prueba.sql — Pre-registro (Fase 7.2)
-- Solicitudes de prueba que llegan desde stringwebs.com (/gym/registro).
-- NO tiene tenant_id: es un lead, antes de existir el gym en el SaaS.

create table if not exists solicitudes_prueba (
  id uuid primary key default gen_random_uuid(),

  nombre text not null,
  email text not null,
  telefono text,
  nombre_gym text,

  plan_interes text check (plan_interes in ('basico', 'pro', 'escala')),
  ciudad text,
  miembros_aprox integer,
  como_entero text,
  notas text,

  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'contactado', 'activado', 'descartado')),

  created_at timestamptz not null default now()
);

create index if not exists idx_solicitudes_estado
  on solicitudes_prueba(estado, created_at desc);

-- RLS: sin tenant. Las escrituras entran por service-role (desde stringweb /
-- el endpoint público); las lecturas son del super admin (panel /admin).
alter table solicitudes_prueba enable row level security;

create policy "super_admins_read_solicitudes" on solicitudes_prueba
  for select using (is_super_admin());
