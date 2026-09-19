-- 066_anular_pago_rpc.sql — Anular repone stock de forma atómica (bloque-02)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- anularPago() en TypeScript (lib/queries/pagos.queries.ts) marcaba
-- anulado_at con un update suelto y nunca tocaba inventario: anular la venta
-- de un producto no devolvía el stock. registrar_pago() sí descuenta stock
-- de forma atómica (insert del pago + select…for update + movimiento +
-- update de stock en una sola transacción, ver sql/054_planes_visitas.sql);
-- esta RPC hace el mismo trabajo en reversa, con el mismo lock de fila, para
-- que anular tenga la misma atomicidad que cobrar.
--
-- El resto de anularPago() (revertir fecha_vencimiento si era membresía,
-- desmarcar cuota de crédito) se queda en TypeScript, secuencial, como ya
-- estaba — son ajustes en otras tablas sin el mismo riesgo de condición de
-- carrera que el stock (dos anulaciones concurrentes del mismo pago sí
-- podrían reponer stock dos veces si no se serializan aquí).

create or replace function public.anular_pago(
  p_tenant_id uuid,
  p_pago_id uuid,
  p_motivo text default null
) returns void
language plpgsql
as $$
declare
  v_concepto text;
  v_producto_id uuid;
  v_anulado_at timestamptz;
  v_inv_id uuid;
  v_stock integer;
  v_cantidad integer;
begin
  select concepto, producto_id, anulado_at
  into v_concepto, v_producto_id, v_anulado_at
  from pagos
  where tenant_id = p_tenant_id and id = p_pago_id
  for update;

  if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
  if v_anulado_at is not null then raise exception 'YA_ANULADO'; end if;

  update pagos
  set anulado_at = now(), anulado_motivo = p_motivo
  where tenant_id = p_tenant_id and id = p_pago_id;

  if v_concepto = 'producto' and v_producto_id is not null then
    -- Cantidad real vendida: el movimiento de salida que dejó este mismo
    -- cobro (ver registrar_pago). Si no se encuentra (venta previa a este
    -- movimiento, o dato limpiado a mano), se asume 1 como venía haciendo
    -- crearReembolso() en el mismo caso.
    select coalesce(
      (select cantidad from movimientos_inventario
       where tenant_id = p_tenant_id and pago_id = p_pago_id and tipo = 'salida'
       order by created_at desc limit 1),
      1
    ) into v_cantidad;

    select id, stock_actual into v_inv_id, v_stock
    from inventario
    where tenant_id = p_tenant_id and producto_id = v_producto_id
    for update;

    if v_inv_id is not null then
      insert into movimientos_inventario (
        tenant_id, producto_id, tipo, cantidad, motivo, pago_id
      ) values (
        p_tenant_id, v_producto_id, 'entrada', v_cantidad, 'Anulación de venta', p_pago_id
      );
      update inventario
      set stock_actual = v_stock + v_cantidad,
          unidades_vendidas = greatest(coalesce(unidades_vendidas, 0) - v_cantidad, 0)
      where id = v_inv_id;
    end if;
    -- Si el inventario ya no existe (producto eliminado), el pago igual
    -- queda anulado: no hay stock al que reponer.
  end if;
end;
$$;

grant execute on function public.anular_pago(uuid, uuid, text) to authenticated;
