-- 047_registrar_pago_rpc.sql — Cobro atómico (Bug #5)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Ejecuta en UNA transacción: insert del pago + descuento de stock (con lock de
-- fila, que además arregla la race condition de stock/unidades_vendidas) +
-- extensión de membresía. Si CUALQUIER paso falla, todo revierte -> elimina los
-- descuadres silenciosos del flujo anterior (insert seguido de updates
-- secuenciales sin transacción, que dejaban datos inconsistentes con solo un
-- "revísalo manualmente").
--
-- SECURITY INVOKER (default): corre con los permisos del usuario que llama, así
-- las políticas RLS por tenant se siguen aplicando dentro de la función.

create or replace function public.registrar_pago(
  p_tenant_id uuid,
  p_concepto text,
  p_monto numeric,
  p_token text,
  p_metodo_pago text default null,
  p_miembro_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fin date default null,
  p_plan_id uuid default null,
  p_promocion_id uuid default null,
  p_producto_id uuid default null,
  p_cantidad_producto integer default null
) returns uuid
language plpgsql
as $$
declare
  v_pago_id uuid;
  v_inv_id uuid;
  v_stock integer;
  v_cantidad integer;
begin
  -- 1. Pago (el folio lo asigna el trigger set_pago_folio en el insert).
  insert into pagos (
    tenant_id, miembro_id, concepto, monto, metodo_pago,
    periodo_inicio, periodo_fin, plan_id, promocion_id, producto_id,
    token_publico
  ) values (
    p_tenant_id, p_miembro_id, p_concepto, p_monto, p_metodo_pago,
    p_periodo_inicio, p_periodo_fin, p_plan_id, p_promocion_id, p_producto_id,
    p_token
  )
  returning id into v_pago_id;

  -- 2. Venta de producto: descuento de stock con lock de fila (serializa
  --    ventas concurrentes del mismo producto -> sin race condition).
  if p_concepto = 'producto' and p_producto_id is not null then
    v_cantidad := coalesce(p_cantidad_producto, 1);

    select id, stock_actual into v_inv_id, v_stock
    from inventario
    where tenant_id = p_tenant_id and producto_id = p_producto_id
    for update;

    if v_inv_id is null then
      raise exception 'INVENTARIO_NO_ENCONTRADO';
    end if;

    if v_stock - v_cantidad < 0 then
      raise exception 'STOCK_INSUFICIENTE';
    end if;

    insert into movimientos_inventario (
      tenant_id, producto_id, tipo, cantidad, motivo, pago_id
    ) values (
      p_tenant_id, p_producto_id, 'salida', v_cantidad, 'Venta en caja', v_pago_id
    );

    update inventario
    set stock_actual = v_stock - v_cantidad,
        unidades_vendidas = coalesce(unidades_vendidas, 0) + v_cantidad
    where id = v_inv_id;
  end if;

  -- 3. Pago de membresía: extender vencimiento + plan (sin pisar plan si viene
  --    nulo). El estado se mantiene por compatibilidad; la fuente de verdad es
  --    fecha_vencimiento.
  if p_concepto = 'membresia'
     and p_miembro_id is not null
     and p_periodo_fin is not null then
    update miembros
    set fecha_vencimiento = p_periodo_fin,
        estado = 'activo',
        plan_id = coalesce(p_plan_id, plan_id)
    where tenant_id = p_tenant_id and id = p_miembro_id;
  end if;

  return v_pago_id;
end;
$$;

grant execute on function public.registrar_pago(
  uuid, text, numeric, text, text, uuid, date, date, uuid, uuid, uuid, integer
) to authenticated;
