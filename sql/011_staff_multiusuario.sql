-- Fase 6.8: Multiusuario con roles Staff
-- Ejecutar en Supabase SQL Editor

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null default 'receptionist' check (rol in ('owner', 'receptionist')),
  estado text not null default 'invitado' check (estado in (
    'invitado',     -- recibió email, aún no aceptó
    'activo',       -- aceptó invitación y puede entrar
    'desactivado'   -- el owner lo desactivó manualmente
  )),
  created_at timestamptz not null default now(),
  activado_at timestamptz,
  desactivado_at timestamptz,
  ultima_sesion_at timestamptz,

  unique (gym_id, email)
);

create index if not exists idx_staff_gym on staff(gym_id);
create index if not exists idx_staff_user on staff(user_id);
create index if not exists idx_staff_email on staff(email);
create index if not exists idx_staff_activos on staff(gym_id, estado) where estado = 'activo';

-- RLS — solo el owner del gym puede ver/gestionar el staff de su gym.
-- (La resolución del rol de un recepcionista se hace con service-role.)
alter table staff enable row level security;

create policy "owner_can_view_staff"
on staff for select to authenticated
using (gym_id in (select id from gyms where owner_id = auth.uid()));

create policy "owner_can_insert_staff"
on staff for insert to authenticated
with check (gym_id in (select id from gyms where owner_id = auth.uid()));

create policy "owner_can_update_staff"
on staff for update to authenticated
using (gym_id in (select id from gyms where owner_id = auth.uid()));

create policy "owner_can_delete_staff"
on staff for delete to authenticated
using (gym_id in (select id from gyms where owner_id = auth.uid()));

-- Trigger: crear staff "owner" automáticamente al crear un gym
create or replace function create_owner_staff()
returns trigger as $$
begin
  insert into staff (gym_id, user_id, email, nombre, rol, estado, activado_at)
  values (
    new.id,
    new.owner_id,
    (select email from auth.users where id = new.owner_id),
    coalesce((select raw_user_meta_data->>'nombre' from auth.users where id = new.owner_id), 'Owner'),
    'owner',
    'activo',
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_create_owner_staff on gyms;
create trigger trigger_create_owner_staff
  after insert on gyms
  for each row
  execute function create_owner_staff();

-- Backfill: staff "owner" para gyms existentes que no lo tengan
insert into staff (gym_id, user_id, email, nombre, rol, estado, activado_at)
select g.id, g.owner_id, u.email,
  coalesce(u.raw_user_meta_data->>'nombre', 'Owner'), 'owner', 'activo', now()
from gyms g
join auth.users u on u.id = g.owner_id
where not exists (
  select 1 from staff s where s.gym_id = g.id and s.rol = 'owner'
);
