-- 037_portal_miembro.sql — Portal del Miembro: autenticación propia (Fase 8.0)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- Los miembros NO son usuarios de Supabase Auth (son clientes del gym, no del
-- SaaS). Se autentican con su teléfono/email + un código de un solo uso (OTP)
-- y obtienen una sesión de 30 días.
--
-- SEGURIDAD — RLS habilitado SIN policies:
-- Como los miembros no tienen `auth.uid()`, `user_gym_ids()` no aplica a
-- ellos. Estas tablas se manejan EXCLUSIVAMENTE server-side con service-role
-- (createAdminClient), que bypassa RLS. Con RLS activo y sin políticas, la
-- anon key no puede leerlas ni escribirlas: quedan selladas al backend.
-- El scoping por tenant/miembro se hace en código, validando el token de
-- sesión en cada request del portal.
--
-- CANAL DE ENTREGA — hoy solo email:
-- El envío automático por WhatsApp está dormido (llega en Fase 7.5 con
-- 360dialog). Hoy el OTP se entrega por email (Resend). La columna `canal`
-- ya contempla whatsapp/sms para activarlos sin migración cuando exista 7.5.

-- ─────────────── Códigos de verificación (OTP) ───────────────
-- Un solo uso, expiran a los 10 minutos. Se guarda solo el hash del código.
create table if not exists miembro_verificaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  codigo_hash text not null,                 -- sha256 del código de 6 dígitos
  canal text not null check (canal in ('email', 'whatsapp', 'sms')),
  expira_at timestamptz not null,
  usado_at timestamptz,                       -- single-use: se sella al validar
  intentos integer not null default 0,        -- anti fuerza bruta
  created_at timestamptz not null default now()
);

-- Última verificación vigente de un miembro.
create index if not exists idx_miembro_verif_lookup
  on miembro_verificaciones(miembro_id, created_at desc);

-- ─────────────── Sesiones del portal ───────────────
-- 30 días. El token crudo vive en una cookie httpOnly; en BD solo su hash.
create table if not exists miembro_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  token_hash text not null unique,            -- sha256 del token de sesión
  expira_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_miembro_sessions_miembro
  on miembro_sessions(miembro_id);

-- ─────────────── RLS: sellado a service-role ───────────────
alter table miembro_verificaciones enable row level security;
alter table miembro_sessions enable row level security;
-- Intencionalmente SIN create policy: nadie con anon key accede; solo el
-- backend con service-role.
