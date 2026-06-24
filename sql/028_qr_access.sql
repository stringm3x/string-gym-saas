-- 028_qr_access.sql — Acceso QR (Fase 7.8, Bloque 1)
-- Token único por miembro para su QR de acceso.

-- qr_token: token único GLOBAL (la página pública /qr/[token] lo busca sin
-- contexto de tenant, así que no puede colisionar entre gyms).
-- Default vía gen_random_uuid() (built-in, sin pgcrypto): rellena también a
-- los miembros existentes con un token único cada uno.
alter table miembros
  add column if not exists qr_token text unique
    default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists qr_generado_at timestamptz default now();

-- Índice para lookup por (tenant, token) en el scanner (tenant isolation).
-- El UNIQUE de qr_token ya crea el índice global para la página pública.
create index if not exists idx_miembros_qr_tenant
  on miembros(tenant_id, qr_token);
