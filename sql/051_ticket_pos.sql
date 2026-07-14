-- 051_ticket_pos.sql — Carrito / ticket POS multi-línea (B4)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Un ticket agrupa varias líneas (productos y/o una membresía) en un solo cobro.
-- Cada línea sigue siendo un `pago` (así corte, ingresos, stock y recibos por
-- línea funcionan sin cambios); comparten `ticket_id`. El RPC registra todas las
-- líneas + stock + membresía en UNA transacción: si algo falla, revierte todo.

alter table pagos add column if not exists ticket_id uuid;

create index if not exists idx_pagos_ticket
  on pagos(tenant_id, ticket_id)
  where ticket_id is not null;

-- Registra un ticket completo de forma atómica. `p_items` es un arreglo jsonb:
--   [{ "tipo":"producto","producto_id":"…","cantidad":2,"monto":900 },
--    { "tipo":"membresia","plan_id":"…","monto":500,
--      "periodo_inicio":"2026-07-01","periodo_fin":"2026-08-01" }]
-- Los montos y periodos ya vienen calculados y validados server-side.
create or replace function public.registrar_ticket(
  p_tenant_id uuid,
  p_metodo_pago text,
  p_token text,
  p_miembro_id uuid,
  p_items jsonb
) returns uuid
language plpgsql
as $$
declare
  v_ticket_id uuid := gen_random_uuid();
  v_item jsonb;
  v_primero boolean := true;
  v_pago_id uuid;
  v_prod uuid;
  v_inv_id uuid;
  v_stock integer;
  v_cant integer;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into pagos (
      tenant_id, miembro_id, concepto, monto, metodo_pago,
      plan_id, producto_id, periodo_inicio, periodo_fin,
      ticket_id, token_publico
    ) values (
      p_tenant_id,
      p_miembro_id,
      v_item->>'tipo',
      (v_item->>'monto')::numeric,
      p_metodo_pago,
      nullif(v_item->>'plan_id', '')::uuid,
      nullif(v_item->>'producto_id', '')::uuid,
      nullif(v_item->>'periodo_inicio', '')::date,
      nullif(v_item->>'periodo_fin', '')::date,
      v_ticket_id,
      -- Un solo token público para el ticket, en la primera línea.
      case when v_primero then p_token else null end
    )
    returning id into v_pago_id;
    v_primero := false;

    -- Producto: descontar stock con lock de fila.
    v_prod := nullif(v_item->>'producto_id', '')::uuid;
    if v_item->>'tipo' = 'producto' and v_prod is not null then
      v_cant := coalesce((v_item->>'cantidad')::integer, 1);

      select id, stock_actual into v_inv_id, v_stock
      from inventario
      where tenant_id = p_tenant_id and producto_id = v_prod
      for update;
      if v_inv_id is null then
        raise exception 'INVENTARIO_NO_ENCONTRADO';
      end if;
      if v_stock - v_cant < 0 then
        raise exception 'STOCK_INSUFICIENTE';
      end if;

      insert into movimientos_inventario (
        tenant_id, producto_id, tipo, cantidad, motivo, pago_id
      ) values (
        p_tenant_id, v_prod, 'salida', v_cant, 'Venta en caja', v_pago_id
      );
      update inventario
      set stock_actual = v_stock - v_cant,
          unidades_vendidas = coalesce(unidades_vendidas, 0) + v_cant
      where id = v_inv_id;
    end if;

    -- Membresía: extender vigencia + plan.
    if v_item->>'tipo' = 'membresia'
       and p_miembro_id is not null
       and nullif(v_item->>'periodo_fin', '') is not null then
      update miembros
      set fecha_vencimiento = (v_item->>'periodo_fin')::date,
          estado = 'activo',
          plan_id = coalesce(nullif(v_item->>'plan_id', '')::uuid, plan_id)
      where tenant_id = p_tenant_id and id = p_miembro_id;
    end if;
  end loop;

  return v_ticket_id;
end;
$$;

grant execute on function public.registrar_ticket(uuid, text, text, uuid, jsonb)
  to authenticated;
