-- 041_planes_pago_producto.sql — Pagos a plazos también para productos (ext 7.7)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- Hasta ahora un plan a plazos (`planes_pago`) se ligaba a un plan de
-- membresía. Ahora también puede ser de un PRODUCTO del inventario: el miembro
-- se lleva el producto hoy (se descuenta stock al crear el plan) y lo paga en
-- cuotas. Un plan es de membresía (plan_membresia_id) O de producto
-- (producto_id); nunca ambos.

alter table planes_pago
  add column if not exists producto_id uuid
    references productos(id) on delete set null,
  add column if not exists cantidad integer check (cantidad is null or cantidad >= 1);
