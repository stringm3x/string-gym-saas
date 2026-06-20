-- Fase 6.8: permitir a staff activo LEER su gym
-- Ejecutar en Supabase SQL Editor
--
-- Sin esto, un recepcionista no puede leer su fila de `gyms` con el client
-- de sesión, y tanto el login como el middleware lo rechazan aunque su
-- registro de staff esté activo.
--
-- Se usa una función SECURITY DEFINER para leer `staff` SIN RLS y evitar
-- la recursión infinita gyms -> staff -> gyms (la policy owner_can_view_staff
-- de `staff` referencia `gyms`).

create or replace function public.user_gym_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select gym_id
  from staff
  where user_id = auth.uid()
    and estado = 'activo';
$$;

drop policy if exists "active_staff_can_read_their_gym" on gyms;

create policy "active_staff_can_read_their_gym"
on gyms for select to authenticated
using (id in (select public.user_gym_ids()));
