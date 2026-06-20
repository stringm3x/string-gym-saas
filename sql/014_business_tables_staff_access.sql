-- Migración 014: actualizar RLS de tablas de negocio
--
-- Cambia de "tenant_id IN (gyms del owner)" a
-- "tenant_id IN (user_gym_ids())" para que tanto owners como
-- staff activo puedan operar las tablas de negocio del gym.
--
-- Agrega WITH CHECK además de USING para prevenir que un staff
-- inserte registros con tenant_id de otro gym.
--
-- Las policies originales (tenant_isolation_X) se reemplazan
-- manteniendo sus nombres para no romper referencias.

-- ============================================
-- Tabla: checkins
-- ============================================
drop policy if exists "tenant_isolation_checkins" on checkins;
create policy "tenant_isolation_checkins"
on checkins
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: gym_addons
-- ============================================
drop policy if exists "tenant_isolation_gym_addons" on gym_addons;
create policy "tenant_isolation_gym_addons"
on gym_addons
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: inventario
-- ============================================
drop policy if exists "tenant_isolation_inventario" on inventario;
create policy "tenant_isolation_inventario"
on inventario
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: miembros
-- ============================================
drop policy if exists "tenant_isolation_miembros" on miembros;
create policy "tenant_isolation_miembros"
on miembros
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: miembros_tags
-- ============================================
drop policy if exists "tenant_isolation_miembros_tags" on miembros_tags;
create policy "tenant_isolation_miembros_tags"
on miembros_tags
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: movimientos_inventario
-- ============================================
drop policy if exists "tenant_isolation_mov_inv" on movimientos_inventario;
create policy "tenant_isolation_mov_inv"
on movimientos_inventario
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: notas
-- ============================================
drop policy if exists "tenant_isolation_notas" on notas;
create policy "tenant_isolation_notas"
on notas
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: pagos
-- ============================================
drop policy if exists "tenant_isolation_pagos" on pagos;
create policy "tenant_isolation_pagos"
on pagos
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: planes_membresia
-- ============================================
drop policy if exists "tenant_isolation_planes" on planes_membresia;
create policy "tenant_isolation_planes"
on planes_membresia
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: plantillas_mensaje
-- ============================================
drop policy if exists "tenant_isolation_plantillas" on plantillas_mensaje;
create policy "tenant_isolation_plantillas"
on plantillas_mensaje
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: productos
-- ============================================
drop policy if exists "tenant_isolation_productos" on productos;
create policy "tenant_isolation_productos"
on productos
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: promociones
-- ============================================
drop policy if exists "tenant_isolation_promociones" on promociones;
create policy "tenant_isolation_promociones"
on promociones
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: prospectos
-- ============================================
drop policy if exists "tenant_isolation_prospectos" on prospectos;
create policy "tenant_isolation_prospectos"
on prospectos
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: prospectos_tags
-- ============================================
drop policy if exists "tenant_isolation_prospectos_tags" on prospectos_tags;
create policy "tenant_isolation_prospectos_tags"
on prospectos_tags
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));

-- ============================================
-- Tabla: tags
-- ============================================
drop policy if exists "tenant_isolation_tags" on tags;
create policy "tenant_isolation_tags"
on tags
for all
to authenticated
using (tenant_id in (select public.user_gym_ids()))
with check (tenant_id in (select public.user_gym_ids()));
