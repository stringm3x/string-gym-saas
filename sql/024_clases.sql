-- 024_clases.sql — Sistema de Clases con Cupo (Fase 7.10, Bloque 1)
-- Tablas: clases, clases_sesiones, clases_reservas + triggers + RLS.

-- ───────────── 0. Función updated_at (idempotente, self-contained) ─────────────
-- Ya existe en la DB (creada por 020). La redefinimos idéntica para que esta
-- migración funcione aunque se corra en un entorno limpio.
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────── 1. Tablas ─────────────────────────────

-- Clases del gym (plantilla: recurrente o única).
create table if not exists clases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,

  nombre text not null,
  descripcion text,
  instructor text,
  color text default '#10b981',

  tipo text not null default 'regular'
    check (tipo in ('regular', 'gratis', 'taller', 'privada')),

  duracion_minutos integer not null default 60,
  cupo_maximo integer not null default 15,

  es_recurrente boolean not null default true,
  -- Días de la semana para recurrentes: 0=domingo … 6=sábado.
  dias_semana integer[] default '{}',
  hora_inicio time not null,

  fecha_inicio date not null default current_date,
  fecha_fin date,

  activa boolean not null default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sesiones individuales (instancias concretas de una clase).
create table if not exists clases_sesiones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  clase_id uuid not null references clases(id) on delete cascade,

  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,

  cupo_maximo integer not null,
  cupo_disponible integer not null,

  estado text not null default 'programada'
    check (estado in ('programada', 'en_curso', 'completada', 'cancelada')),
  notas text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Una clase no puede tener dos sesiones el mismo día a la misma hora.
  unique (clase_id, fecha, hora_inicio)
);

-- Reservas de una sesión.
create table if not exists clases_reservas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  sesion_id uuid not null references clases_sesiones(id) on delete cascade,

  miembro_id uuid references miembros(id) on delete set null,
  prospecto_id uuid references prospectos(id) on delete set null,
  nombre_visitante text,
  telefono_visitante text,

  estado text not null default 'confirmada'
    check (estado in ('confirmada', 'en_lista_espera', 'cancelada', 'asistio', 'no_asistio')),

  check_in_at timestamptz,
  check_in_by uuid references auth.users(id) on delete set null,

  origen text not null default 'manual'
    check (origen in ('manual', 'api', 'portal')),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Una persona no puede tener 2 reservas en la misma sesión.
  -- (NULL no choca, así que varios visitantes sin registro conviven.)
  unique (sesion_id, miembro_id),
  unique (sesion_id, prospecto_id)
);

-- ───────────────────────────── 2. Triggers ─────────────────────────────

create trigger clases_updated_at
  before update on clases
  for each row execute function update_updated_at();

create trigger clases_sesiones_updated_at
  before update on clases_sesiones
  for each row execute function update_updated_at();

create trigger clases_reservas_updated_at
  before update on clases_reservas
  for each row execute function update_updated_at();

-- Recalcula cupo_disponible automáticamente al insertar/editar/borrar reservas.
-- MEJORA vs plan: contamos SOLO 'confirmada' (no 'en_lista_espera'), para que
-- cupo_disponible = lugares confirmados libres y nunca sea negativo. La lista
-- de espera no consume cupo; se promueve cuando se libera un lugar.
create or replace function actualizar_cupo_sesion()
returns trigger
language plpgsql
security definer
as $$
begin
  update clases_sesiones
  set cupo_disponible = cupo_maximo - (
    select count(*) from clases_reservas
    where sesion_id = coalesce(new.sesion_id, old.sesion_id)
      and estado = 'confirmada'
  )
  where id = coalesce(new.sesion_id, old.sesion_id);
  return coalesce(new, old);
end;
$$;

create trigger reservas_actualizar_cupo
  after insert or update or delete on clases_reservas
  for each row execute function actualizar_cupo_sesion();

-- ───────────────────────────── 3. RLS ─────────────────────────────

alter table clases enable row level security;
alter table clases_sesiones enable row level security;
alter table clases_reservas enable row level security;

-- Aislamiento por tenant (owner ∪ staff activo) vía user_gym_ids().
create policy "tenant_access_clases"
  on clases for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

create policy "tenant_access_sesiones"
  on clases_sesiones for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

create policy "tenant_access_reservas"
  on clases_reservas for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

-- Lectura pública de sesiones programadas con cupo (para API, Fase 7.11).
create policy "public_read_sesiones_activas"
  on clases_sesiones for select
  to anon
  using (
    estado = 'programada'
    and fecha >= current_date
    and cupo_disponible > 0
  );

-- ───────────────────────────── 4. Índices ─────────────────────────────

create index if not exists idx_clases_tenant on clases(tenant_id, activa);
create index if not exists idx_sesiones_fecha on clases_sesiones(tenant_id, fecha, hora_inicio);
create index if not exists idx_reservas_sesion on clases_reservas(sesion_id, estado);
create index if not exists idx_reservas_miembro on clases_reservas(miembro_id, tenant_id);
