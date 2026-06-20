-- Fase 6.8: Auto-lectura del propio registro de staff
-- Ejecutar en Supabase SQL Editor (ya ejecutado por Carlos)
--
-- Permite que cada usuario autenticado lea SU propia fila de staff,
-- para resolver su rol con el client de sesión normal (sin service-role).
-- El owner ya podía leer todo su staff vía "owner_can_view_staff" (011);
-- esta policy es aditiva y no afecta su acceso.

create policy "users_can_read_own_staff_record"
on staff for select to authenticated
using (user_id = auth.uid());
