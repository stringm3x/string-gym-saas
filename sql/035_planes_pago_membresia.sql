-- 035_planes_pago_membresia.sql — Liga el plan de pago a un plan de membresía
-- (Fase 7.7, Bloque 1). ⚠️ NO APLICADA. Carlos la valida y corre.
--
-- El primer pago de un plan a cuotas debe extender la membresía "igual que un
-- cobro normal", lo que requiere conocer la duración (planes_membresia.
-- dias_duracion). `planes_pago` no lo referenciaba; se agrega aquí. Nullable
-- por si algún plan a plazos no fuera de membresía (concepto libre).

alter table planes_pago
  add column if not exists plan_membresia_id uuid
    references planes_membresia(id) on delete set null;
