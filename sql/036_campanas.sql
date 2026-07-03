-- 036_campanas.sql — Campañas / Mensajes masivos por WhatsApp (Fase 7.6)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- El dueño arma un mensaje para un segmento de miembros/prospectos. En esta
-- fase el envío es MANUAL (links wa.me abiertos uno a uno); cuando exista la
-- Fase 7.5 (360dialog) se agregará el envío automático. Esta tabla registra
-- la campaña y a cuántos se envió, para historial.

create table if not exists campanas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  nombre text not null,
  mensaje text not null,
  audiencia text not null
    check (audiencia in (
      'todos_activos',
      'por_vencer_7d',
      'por_vencer_30d',
      'vencidos',
      'sin_actividad_14d',
      'prospectos'
    )),
  total_destinatarios integer not null default 0,
  enviada_at timestamptz,
  creada_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Historial del tenant, más recientes primero.
create index if not exists idx_campanas_tenant
  on campanas(tenant_id, created_at desc);

alter table campanas enable row level security;

-- Aislamiento por tenant (owner ∪ staff activo) vía user_gym_ids().
create policy "campanas_tenant" on campanas
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
