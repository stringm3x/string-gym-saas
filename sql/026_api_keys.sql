-- 026_api_keys.sql — API Pública (Fase 7.11, Bloque 1)
-- API keys por gym + log de uso de la API REST pública.

-- ─────────────────────────── 1. Tablas ───────────────────────────

-- Una API key por gym. La key se genera en la app (crypto), no en SQL,
-- para no depender de pgcrypto; aquí solo se exige unique/not null.
create table if not exists gym_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references gyms(id) on delete cascade,
  api_key text not null unique,
  activa boolean not null default true,
  nombre text default 'Clave principal',
  ultimo_uso timestamptz,
  requests_totales integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Log de uso (no expone la API key; solo endpoint/método/status).
create table if not exists api_requests_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  endpoint text not null,
  method text not null,
  status_code integer not null,
  ip_address text,
  created_at timestamptz default now()
);

create index if not exists idx_api_log_tenant
  on api_requests_log(tenant_id, created_at desc);
create index if not exists idx_api_keys_key
  on gym_api_keys(api_key) where activa = true;

-- ─────────────────────────── 2. Trigger / función ───────────────────────────

create trigger gym_api_keys_updated_at
  before update on gym_api_keys
  for each row execute function update_updated_at();

-- Incrementa el contador de uso de una key (atómico, fire-and-forget desde
-- el helper de auth). SECURITY DEFINER → corre como owner, sin RLS.
create or replace function bump_api_key_usage(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update gym_api_keys
    set ultimo_uso = now(), requests_totales = requests_totales + 1
    where api_key = p_key;
$$;

-- ─────────────────────────── 3. RLS ───────────────────────────
-- El acceso de la API usa service-role (bypassa RLS). Estas policies son
-- para que el OWNER vea/gestione su key y su log desde el app.

alter table gym_api_keys enable row level security;
alter table api_requests_log enable row level security;

create policy "owner_access_api_keys"
  on gym_api_keys for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

create policy "owner_read_api_log"
  on api_requests_log for select
  using (tenant_id in (select public.user_gym_ids()));
