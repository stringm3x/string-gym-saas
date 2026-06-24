-- 023_admin_tenant_pagos.sql — PROPUESTA (Fase 7.4, Bloque 4)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- Pagos que STRING recibe de cada gym (B2B): mensualidades del SaaS,
-- setup, migración, etc. NO confundir con `pagos` (cobros que el gym hace
-- a SUS miembros). Se registran manualmente desde el Admin (transferencias).

create table if not exists admin_tenant_pagos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references gyms(id) on delete cascade,
  concepto text not null check (concepto in (
    'mensualidad', 'anualidad', 'setup', 'migracion', 'otro'
  )),
  monto numeric not null check (monto >= 0),
  metodo text not null check (metodo in (
    'transferencia', 'efectivo', 'deposito', 'otro'
  )),
  referencia text,
  fecha_pago date not null,
  notas text,
  admin_user_id uuid not null references auth.users(id),
  admin_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_tenant_pagos_tenant
  on admin_tenant_pagos(tenant_id, fecha_pago desc);

alter table admin_tenant_pagos enable row level security;

-- Solo super admins leen. Las escrituras entran por el panel vía
-- service-role (con gate is_super_admin en el server action + audit log),
-- por eso no exponemos INSERT policy directa.
create policy "admins_read_tenant_pagos" on admin_tenant_pagos
  for select using (is_super_admin());
