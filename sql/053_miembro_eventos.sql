-- 053_miembro_eventos.sql — Historial de eventos del socio (D1 congelar, D2 cambio de plan)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Una sola bitácora para el timeline del socio. Cada evento es de un `tipo`:
--   'congelacion'  → pausa temporal (fecha_inicio/fecha_fin, estado activa/cancelada)
--   'cambio_plan'  → de qué plan a cuál (plan_anterior_id/plan_nuevo_id)

create table if not exists miembro_eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  tipo text not null check (tipo in ('congelacion', 'cambio_plan')),
  creado_por uuid,
  creado_por_nombre text,

  -- Congelación:
  fecha_inicio date,
  fecha_fin date,
  estado text check (estado in ('activa', 'cancelada')),

  -- Cambio de plan:
  plan_anterior_id uuid references planes_membresia(id) on delete set null,
  plan_nuevo_id uuid references planes_membresia(id) on delete set null,

  descripcion text,
  created_at timestamptz not null default now()
);

-- Timeline del socio, más recientes primero.
create index if not exists idx_miembro_eventos_timeline
  on miembro_eventos(tenant_id, miembro_id, created_at desc);

-- Congelaciones activas por miembro (para bloquear check-in en el rango).
create index if not exists idx_miembro_eventos_congelacion
  on miembro_eventos(tenant_id, miembro_id, tipo, estado);

alter table miembro_eventos enable row level security;

create policy "miembro_eventos_tenant" on miembro_eventos
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
