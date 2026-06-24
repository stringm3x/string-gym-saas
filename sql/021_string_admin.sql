-- 021_string_admin.sql — STRING Admin v1 (Fase 7.4, Bloque 2)
-- Super admins de STRING (Carlos) + audit log append-only.
-- NO confundir con `staff` (recepcionistas de cada gym).

-- ─────────────────────────── 1. Tablas ───────────────────────────

create table if not exists string_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text,
  role text not null default 'super_admin' check (role in ('super_admin', 'admin')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  ultimo_acceso timestamptz
);

create table if not exists admin_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  admin_email text not null,
  accion text not null,
  target_tenant_id uuid references gyms(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_events_tenant
  on admin_events(target_tenant_id, created_at desc);
create index if not exists idx_admin_events_admin
  on admin_events(admin_user_id, created_at desc);
create index if not exists idx_admin_events_created
  on admin_events(created_at desc);

-- ───────────── 2. Funciones helper (SECURITY DEFINER) ─────────────
-- SECURITY DEFINER → corren como owner y BYPASSAN RLS. Esto es lo que
-- evita la recursión infinita en la policy de string_admins (una policy
-- que se consulta a sí misma vía función definer no recurre).

create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from string_admins
    where user_id = auth.uid() and activo = true
  );
$$;

-- Marca el último acceso del admin actual (evita exponer un UPDATE policy).
create or replace function touch_admin_last_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update string_admins
    set ultimo_acceso = now()
    where user_id = auth.uid() and activo = true;
end;
$$;

-- Registra un evento administrativo. Único camino de escritura a
-- admin_events (no hay INSERT policy) → append-only garantizado.
create or replace function log_admin_event(
  p_accion text,
  p_target_tenant_id uuid default null,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'no autorizado';
  end if;

  insert into admin_events (
    admin_user_id, admin_email, accion,
    target_tenant_id, target_user_id, metadata
  )
  values (
    auth.uid(),
    coalesce((select email from auth.users where id = auth.uid()), ''),
    p_accion,
    p_target_tenant_id,
    p_target_user_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- ─────────────────────────── 3. RLS ───────────────────────────

alter table string_admins enable row level security;
alter table admin_events enable row level security;

-- Lectura de string_admins: el propio admin lee SU fila (user_id =
-- auth.uid()); un super admin activo lee todas (vía función definer,
-- sin recursión). Sin INSERT/UPDATE/DELETE policy: la gestión de admins
-- se hace manualmente en Supabase (Bloque 2) o por service-role futuro.
create policy "admins_read_admins" on string_admins
  for select using (user_id = auth.uid() or is_super_admin());

-- Audit log: solo super admins leen. Sin policies de escritura → los
-- inserts entran únicamente por log_admin_event() (definer) y nunca se
-- actualiza ni borra: append-only.
create policy "admins_read_events" on admin_events
  for select using (is_super_admin());
