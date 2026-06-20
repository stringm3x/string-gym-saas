-- Fase 6.7: Personalización de marca del gym
-- Ejecutar en Supabase SQL Editor

-- Campos de personalización en gyms (logo_url ya existía de fases previas)
alter table gyms
  add column if not exists logo_url text,
  add column if not exists color_acento text default '#50ff05',
  add column if not exists color_sidebar text default '#141414',
  add column if not exists favicon_url text;

-- Validaciones de formato HEX
alter table gyms
  add constraint check_color_acento_hex
    check (color_acento is null or color_acento ~ '^#[0-9a-fA-F]{6}$');

alter table gyms
  add constraint check_color_sidebar_hex
    check (color_sidebar is null or color_sidebar ~ '^#[0-9a-fA-F]{6}$');

-- Bucket de Supabase Storage para logos
insert into storage.buckets (id, name, public)
values ('gym-logos', 'gym-logos', true)
on conflict (id) do nothing;

-- RLS: solo el owner del gym puede subir/modificar/borrar su logo
create policy "tenants_can_upload_own_logo"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gym-logos'
  and (storage.foldername(name))[1] in (
    select id::text from gyms where owner_id = auth.uid()
  )
);

create policy "tenants_can_update_own_logo"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'gym-logos'
  and (storage.foldername(name))[1] in (
    select id::text from gyms where owner_id = auth.uid()
  )
);

create policy "tenants_can_delete_own_logo"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'gym-logos'
  and (storage.foldername(name))[1] in (
    select id::text from gyms where owner_id = auth.uid()
  )
);

-- Lectura pública del bucket
create policy "public_read_gym_logos"
on storage.objects
for select
to public
using (bucket_id = 'gym-logos');
