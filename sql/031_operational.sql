-- 031_operational.sql — Operational Layer SaaS (Fase 7.3, Bloque 1)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- Añade: aceptación de Términos, flag de suspensión automática y la tabla
-- de notificaciones in-app.
--
-- NOTA sobre la prueba gratuita: el plan mencionaba `trial_hasta`, pero la
-- columna `gyms.prueba_hasta` (migración 022, ya aplicada y en uso por el
-- Admin) cumple exactamente esa función. Se REUSA `prueba_hasta` como fin de
-- prueba en vez de crear una columna duplicada. Igual para la suspensión:
-- ya existen `suspendido_at` y `suspension_motivo`.

-- ─────────────────────────── gyms ───────────────────────────
alter table gyms
  add column if not exists acepto_terminos_at timestamptz,
  -- Distingue una suspensión automática (prueba vencida) de una manual del
  -- Admin. Útil para saber si el sistema puede reactivar sin intervención.
  add column if not exists suspension_auto boolean not null default false;

-- ─────────────────────── gym_notifications ───────────────────────
create table if not exists gym_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  tipo text not null
    check (tipo in ('vencimiento', 'pago', 'prospecto', 'sistema', 'clase')),
  titulo text not null,
  mensaje text,
  leida boolean not null default false,
  accion_url text,
  created_at timestamptz not null default now()
);

-- Lookup del badge/dropdown: no leídas por tenant, más recientes primero.
create index if not exists idx_gym_notifications_tenant
  on gym_notifications(tenant_id, leida, created_at desc);

alter table gym_notifications enable row level security;

-- Aislamiento por tenant (owner ∪ staff activo) vía user_gym_ids().
create policy "gym_notifications_tenant" on gym_notifications
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
