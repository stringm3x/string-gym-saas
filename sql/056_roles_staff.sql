-- 056_roles_staff.sql — Roles entrenador y gerente (D6)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Amplía los roles de staff de {owner, receptionist} a también {entrenador,
-- gerente}. Los permisos por rol viven en el código (lib/permissions.ts).

alter table staff
  drop constraint if exists staff_rol_check;

alter table staff
  add constraint staff_rol_check
  check (rol in ('owner', 'receptionist', 'entrenador', 'gerente'));
