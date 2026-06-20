-- Migración 013b: user_gym_ids() ahora cubre owner Y staff activo
--
-- Razón: hacer la función robusta para que policies futuras (014)
-- no dependan del trigger create_owner_staff para que el owner
-- tenga acceso a sus datos. Owner entra por gyms.owner_id directo;
-- staff entra por staff.estado='activo'.
--
-- Reemplaza la versión de 013 (que solo cubría staff activo).

create or replace function public.user_gym_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  -- Owner directo: independiente del trigger create_owner_staff
  select id from gyms where owner_id = auth.uid()

  union

  -- Staff activo: invitados que aceptaron y siguen activos
  select gym_id from staff
  where user_id = auth.uid()
    and estado = 'activo';
$$;
