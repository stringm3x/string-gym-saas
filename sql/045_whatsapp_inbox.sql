-- 045_whatsapp_inbox.sql — Inbox de WhatsApp en el SaaS (Fase 7.5C)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- El dueño contesta WhatsApp desde STRING GYM. Dos tablas: conversaciones
-- (una por teléfono) y mensajes (historial). Se pueblan desde el webhook
-- entrante y los envíos salientes.

-- ── Conversaciones ──────────────────────────────────────────────────
create table if not exists wa_conversaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  telefono text not null,
  nombre_contacto text,
  miembro_id uuid references miembros(id) on delete set null,
  ultimo_mensaje_at timestamptz,
  no_leidos integer not null default 0,
  bot_activo boolean not null default true,
  created_at timestamptz not null default now(),

  unique (tenant_id, telefono)
);

-- Lista del inbox: conversaciones del gym, más recientes primero.
create index if not exists idx_wa_conversaciones_inbox
  on wa_conversaciones(tenant_id, ultimo_mensaje_at desc);

alter table wa_conversaciones enable row level security;

create policy "wa_conversaciones_tenant" on wa_conversaciones
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));

-- ── Mensajes ────────────────────────────────────────────────────────
create table if not exists wa_mensajes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  conversacion_id uuid not null references wa_conversaciones(id) on delete cascade,
  direccion text not null check (direccion in ('entrante', 'saliente')),
  tipo text not null check (tipo in ('texto', 'template', 'bot')),
  contenido text not null,
  enviado_at timestamptz not null default now(),
  leido boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

-- Historial de una conversación, más recientes primero.
create index if not exists idx_wa_mensajes_conversacion
  on wa_mensajes(conversacion_id, enviado_at desc);

alter table wa_mensajes enable row level security;

create policy "wa_mensajes_tenant" on wa_mensajes
  for all
  using (tenant_id in (select public.user_gym_ids()))
  with check (tenant_id in (select public.user_gym_ids()));
