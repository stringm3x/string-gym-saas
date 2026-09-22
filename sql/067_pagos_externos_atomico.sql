-- 067_pagos_externos_atomico.sql — Webhook de MercadoPago atómico (bloque-03)
-- ✅ APLICADA en producción — confirmado por Carlos el 2026-09-20.
--
-- El webhook insertaba en `pagos` directo (admin.from("pagos").insert), sin
-- pasar por registrar_pago ni por pagos_caja, sin checar errores, y con el
-- guard de idempotencia (pagos_externos.status='approved') separado del
-- insert — dos reintentos casi simultáneos del webhook (MP sí los manda)
-- podían leer status≠'approved' los dos y crear DOS pagos para un solo cobro
-- real. Esta RPC hace confirmar-la-fila + registrar-el-pago en una sola
-- transacción: usa registrar_pago (sql/054) para no duplicar la lógica de
-- stock/membresía/visitas, con un `for update` sobre pagos_externos como
-- guarda de concurrencia — igual que anular_pago (sql/066) hace con pagos.
--
-- El enlace a caja (pagos_caja) se queda FUERA de esta transacción a
-- propósito: en el resto del código (createPago/registrarCajaDePagos) es
-- best-effort y no revierte el cobro si falla — aquí se mantiene la misma
-- regla, ahora desde TypeScript (route.ts), no aquí.

-- 1. Unique real: el índice de hoy es solo sobre external_id, no sobre
--    (proveedor, external_id) — dos proveedores podrían emitir el mismo id
--    algún día. La tabla está vacía (nunca ha corrido un checkout en
--    producción), así que no hay nada que limpiar antes de crear el índice.
drop index if exists idx_pagos_externos_external;

create unique index if not exists uq_pagos_externos_proveedor_external
  on pagos_externos(proveedor, external_id);

-- 2. Confirmación atómica del pago externo.
create or replace function public.confirmar_pago_externo(
  p_pagos_externos_id uuid,
  p_tenant_id uuid,
  p_monto numeric,
  p_metodo_pago text,
  p_token text,
  p_miembro_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fin date default null,
  p_plan_id uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_status text;
  v_pago_id uuid;
begin
  select status, pago_id into v_status, v_pago_id
  from pagos_externos
  where id = p_pagos_externos_id and tenant_id = p_tenant_id
  for update;

  if not found then raise exception 'PAGO_EXTERNO_NO_ENCONTRADO'; end if;

  -- Idempotente: si dos entregas del webhook llegan casi juntas, el for
  -- update serializa la segunda detrás de la primera; cuando le toca correr
  -- ya ve 'approved' y regresa el pago_id existente en vez de duplicar.
  if v_status = 'approved' then
    return v_pago_id;
  end if;

  v_pago_id := registrar_pago(
    p_tenant_id, 'membresia', p_monto, p_token, p_metodo_pago,
    p_miembro_id, p_periodo_inicio, p_periodo_fin, p_plan_id,
    null, null, null
  );

  update pagos_externos
  set status = 'approved', metodo = p_metodo_pago, pago_id = v_pago_id
  where id = p_pagos_externos_id;

  return v_pago_id;
end;
$$;

-- El webhook llama esto con el client admin (service-role), no con una
-- sesión de usuario — a diferencia del resto de RPCs de este archivo,
-- llamadas siempre desde acciones autenticadas. Se otorga explícito a
-- service_role por si el rol no trae ya acceso implícito a funciones nuevas
-- del schema public, y de paso a registrar_pago (que confirmar_pago_externo
-- invoca internamente: una función sin SECURITY DEFINER corre con los
-- privilegios de quien la llamó originalmente, así que también necesita el
-- grant para que la llamada anidada no falle por permisos).
grant execute on function public.confirmar_pago_externo(
  uuid, uuid, numeric, text, text, uuid, date, date, uuid
) to authenticated, service_role;

grant execute on function public.registrar_pago(
  uuid, text, numeric, text, text, uuid, date, date, uuid, uuid, uuid, integer
) to service_role;
