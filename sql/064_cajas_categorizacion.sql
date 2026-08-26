-- 064_cajas_categorizacion.sql — Caja por producto + cuadre opcional por caja
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Dos cambios, a partir de que el efectivo de cada caja no siempre está
-- físicamente separado:
--
-- 1. `productos.caja_id`: cada producto sabe a qué caja pertenece su venta
--    (ej. las aguas → caja "Aguas"). Así el cajero ya no elige en qué caja
--    está parado — el sistema lo resuelve solo según qué se vendió.
--    Sin asignar, cae en la caja default del gym (comportamiento de hoy).
--
-- 2. `cajas.requiere_cuadre`: si una caja NO tiene su efectivo separado
--    físicamente, no tiene sentido pedirle fondo inicial ni conteo — solo
--    sirve para categorizar ventas. Apagado por default en cajas nuevas;
--    la caja default queda encendida (mantiene el comportamiento actual).

alter table cajas
  add column if not exists requiere_cuadre boolean not null default false;

update cajas set requiere_cuadre = true where es_default = true;

alter table productos
  add column if not exists caja_id uuid references cajas(id) on delete set null;
