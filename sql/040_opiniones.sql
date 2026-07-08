-- 040_opiniones.sql — Retroalimentación de miembros (Fase P.4)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- Calificación (1–5) opcionalmente con comentario, capturada desde el portal,
-- el kiosco o manualmente. miembro_id es nullable (una opinión de kiosco/manual
-- podría no estar ligada a un miembro); si el miembro se borra, se conserva la
-- opinión sin dueño (set null).

create table if not exists opiniones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid references miembros(id) on delete set null,
  calificacion integer not null check (calificacion between 1 and 5),
  comentario text,
  origen text not null default 'portal'
    check (origen in ('portal', 'kiosco', 'manual')),
  created_at timestamptz not null default now()
);

-- Listado del dueño, más recientes primero.
create index if not exists idx_opiniones_tenant
  on opiniones(tenant_id, created_at desc);

alter table opiniones enable row level security;

create policy "opiniones_tenant" on opiniones
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

-- Google Place ID del gym (Bloque 3): para el botón "Dejar reseña en Google".
-- Opcional; se configura en Configuración → Marca.
alter table gyms
  add column if not exists google_place_id text;
