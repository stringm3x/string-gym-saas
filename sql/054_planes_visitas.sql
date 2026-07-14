-- 054_planes_visitas.sql — Planes por visitas / paquetes (D3)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- Nuevo modelo de vigencia que convive con el de tiempo:
--   tipo 'tiempo'   → vigente si fecha_vencimiento >= hoy (actual)
--   tipo 'visitas'  → vigente si visitas_restantes > 0 (sin límite de tiempo)
--   tipo 'paquete'  → vigente si visitas_restantes > 0 Y fecha_vencimiento >= hoy
--
-- El saldo de visitas del socio (miembros.visitas_restantes) lo setea el cobro
-- (RPCs abajo) al leer el plan, y el check-in lo descuenta.

alter table planes_membresia
  add column if not exists tipo text not null default 'tiempo'
    check (tipo in ('tiempo', 'visitas', 'paquete')),
  add column if not exists visitas integer;

alter table miembros
  add column if not exists visitas_restantes integer;

-- ── RPC registrar_pago (actualizado: setea visitas_restantes según el plan) ──
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
  v_tipo text;
  v_visitas integer;
begin
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

  if p_concepto = 'producto' and p_producto_id is not null then
    v_cantidad := coalesce(p_cantidad_producto, 1);
    select id, stock_actual into v_inv_id, v_stock
    from inventario
    where tenant_id = p_tenant_id and producto_id = p_producto_id
    for update;
    if v_inv_id is null then raise exception 'INVENTARIO_NO_ENCONTRADO'; end if;
    if v_stock - v_cantidad < 0 then raise exception 'STOCK_INSUFICIENTE'; end if;
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

  if p_concepto = 'membresia'
     and p_miembro_id is not null
     and p_periodo_fin is not null then
    -- Tipo del plan → saldo de visitas (visitas/paquete) o null (tiempo).
    select tipo, visitas into v_tipo, v_visitas
    from planes_membresia where id = p_plan_id;
    update miembros
    set fecha_vencimiento = p_periodo_fin,
        estado = 'activo',
        plan_id = coalesce(p_plan_id, plan_id),
        visitas_restantes = case
          when v_tipo in ('visitas', 'paquete') then v_visitas
          else null
        end
    where tenant_id = p_tenant_id and id = p_miembro_id;
  end if;

  return v_pago_id;
end;
$$;

grant execute on function public.registrar_pago(
  uuid, text, numeric, text, text, uuid, date, date, uuid, uuid, uuid, integer
) to authenticated;

-- ── RPC registrar_ticket (actualizado: idem en la línea de membresía) ──
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
  v_plan uuid;
  v_tipo text;
  v_visitas integer;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into pagos (
      tenant_id, miembro_id, concepto, monto, metodo_pago,
      plan_id, producto_id, periodo_inicio, periodo_fin,
      ticket_id, token_publico
    ) values (
      p_tenant_id, p_miembro_id, v_item->>'tipo', (v_item->>'monto')::numeric,
      p_metodo_pago, nullif(v_item->>'plan_id', '')::uuid,
      nullif(v_item->>'producto_id', '')::uuid,
      nullif(v_item->>'periodo_inicio', '')::date,
      nullif(v_item->>'periodo_fin', '')::date,
      v_ticket_id, case when v_primero then p_token else null end
    )
    returning id into v_pago_id;
    v_primero := false;

    v_prod := nullif(v_item->>'producto_id', '')::uuid;
    if v_item->>'tipo' = 'producto' and v_prod is not null then
      v_cant := coalesce((v_item->>'cantidad')::integer, 1);
      select id, stock_actual into v_inv_id, v_stock
      from inventario
      where tenant_id = p_tenant_id and producto_id = v_prod
      for update;
      if v_inv_id is null then raise exception 'INVENTARIO_NO_ENCONTRADO'; end if;
      if v_stock - v_cant < 0 then raise exception 'STOCK_INSUFICIENTE'; end if;
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

    if v_item->>'tipo' = 'membresia'
       and p_miembro_id is not null
       and nullif(v_item->>'periodo_fin', '') is not null then
      v_plan := nullif(v_item->>'plan_id', '')::uuid;
      select tipo, visitas into v_tipo, v_visitas
      from planes_membresia where id = v_plan;
      update miembros
      set fecha_vencimiento = (v_item->>'periodo_fin')::date,
          estado = 'activo',
          plan_id = coalesce(v_plan, plan_id),
          visitas_restantes = case
            when v_tipo in ('visitas', 'paquete') then v_visitas
            else null
          end
      where tenant_id = p_tenant_id and id = p_miembro_id;
    end if;
  end loop;

  return v_ticket_id;
end;
$$;

grant execute on function public.registrar_ticket(uuid, text, text, uuid, jsonb)
  to authenticated;
