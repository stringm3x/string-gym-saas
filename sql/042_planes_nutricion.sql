-- 042_planes_nutricion.sql — Nutrición Nivel 1 (Fase I.6)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
-- (El número 041 ya lo usa la extensión de créditos; esta es la 042.)
--
-- Plan de nutrición asignado por el gym a un miembro. Las comidas se guardan
-- como jsonb: [{ "tiempo": "Desayuno", "alimentos": "3 huevos..." }, ...].

create table if not exists planes_nutricion (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  creada_por uuid references auth.users(id),
  titulo text not null,
  objetivo text,
  calorias_objetivo integer,
  comidas jsonb not null default '[]'::jsonb,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Planes de un miembro, activos primero / más recientes primero.
create index if not exists idx_planes_nutricion_miembro
  on planes_nutricion(tenant_id, miembro_id, activo, created_at desc);

alter table planes_nutricion enable row level security;

create policy "planes_nutricion_tenant" on planes_nutricion
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
