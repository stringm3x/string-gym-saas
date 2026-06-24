-- 022_admin_tenant_fields.sql — PROPUESTA (Fase 7.4, prep Bloque 4)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente cuando decida.
--
-- Agrega los campos que el Admin necesita para gestionar tenants en el
-- Bloque 4 (marcar fundador, estados ricos, prueba, suspensión). El
-- Bloque 3 (lista + filtros) NO depende de esto y ya funciona con las
-- columnas actuales de `gyms`.

alter table gyms
  add column if not exists es_fundador boolean not null default false,
  add column if not exists fundador_desde timestamptz,
  add column if not exists prueba_hasta timestamptz,
  add column if not exists suspendido_at timestamptz,
  add column if not exists suspension_motivo text;

-- Normaliza los estados que usará el Admin. Hoy solo existe 'activo'.
-- IMPORTANTE: antes de crear el constraint, verifica que no haya filas
-- con un estado fuera de esta lista:
--   select distinct estado from gyms;
alter table gyms
  drop constraint if exists check_gym_estado;
alter table gyms
  add constraint check_gym_estado
    check (estado in ('activo', 'prueba', 'suspendido', 'cancelado'));

-- (Opcional) Notas internas por tenant — timeline visible solo a admins.
-- Si prefieres, esto puede vivir en su propia migración del Bloque 4.
create table if not exists admin_tenant_notas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id),
  admin_email text not null,
  nota text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_tenant_notas_tenant
  on admin_tenant_notas(tenant_id, created_at desc);

alter table admin_tenant_notas enable row level security;

create policy "admins_read_tenant_notas" on admin_tenant_notas
  for select using (is_super_admin());
-- Las escrituras entrarán por una función SECURITY DEFINER en el Bloque 4
-- (igual patrón que log_admin_event): no exponemos INSERT policy directa.
