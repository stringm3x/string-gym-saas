-- 061_ganancia_productos.sql — Trazar el costo de ventas de producto a crédito
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Hoy el costo de un producto vendido solo es rastreable si el movimiento de
-- inventario tiene pago_id (venta directa en caja). Los productos vendidos a
-- crédito (planes_pago) descuentan stock al crear el plan, sin pago_id (el
-- pago real llega después, en cuotas separadas, sin producto_id) — su costo
-- quedaba invisible para cualquier cálculo de ganancia.
--
-- plan_pago_id enlaza ese movimiento de salida al plan, para poder sumarle
-- su costo en el rango de fechas en que el stock realmente salió (no en el
-- rango en que se cobra cada cuota — ver lib/queries/cortes.queries.ts).

alter table movimientos_inventario
  add column if not exists plan_pago_id uuid references planes_pago(id) on delete set null;

create index if not exists idx_movimientos_plan_pago
  on movimientos_inventario(plan_pago_id)
  where plan_pago_id is not null;

-- Snapshot del desglose por concepto + ganancia estimada al cerrar un turno
-- (hoy solo se guardan los totales por método de pago; el desglose por
-- concepto solo existía "en vivo" mientras el turno estaba abierto).
alter table cortes_caja
  add column if not exists total_membresia numeric,
  add column if not exists total_visita numeric,
  add column if not exists total_producto numeric,
  add column if not exists total_otro numeric,
  add column if not exists ganancia_productos numeric;
