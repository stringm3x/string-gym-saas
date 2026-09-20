-- ─────────────────────────────────────────────────────────────────────────
-- REPORTE (solo lectura, NO es migración): uso real por feature y por gym
-- de lo que el PR 4 (migración de caja/ a panelAction) empieza a exigir.
--
-- Contexto: docs/autorizacion-acciones.md §6, protocolo para los PRs 4–7.
-- Tres políticas de caja empiezan a exigir una feature de Pro que hoy no
-- se verifica (solo rol):
--   caja.vender_productos   registrarTicketAction        → inventario
--   caja.abonar_plan_pago   registrarAbonoAction         → creditos
--   caja.autorizar_codigo / caja.rechazar_codigo         → kiosco_autoservicio
-- Las otras nueve no cierran nada (caja_basica es Starter; caja.cobrar_mp ya
-- verificaba mercadopago).
--
-- Cómo leerlo: los tenants vivos están en Escala, así que ninguna fila
-- implica pérdida. Lo que importa es `historico` por feature: dice qué
-- cierres han sido ejercidos por un gym real. Una feature en cero en ambos
-- tenants = cierre no probado por nadie → verificar a mano antes del merge.
-- ─────────────────────────────────────────────────────────────────────────

-- ═══════════════ 1. Uso por feature, gym y periodo (90 días) ═══════════════
with periodo as (select now() - interval '90 days' as desde),
g as (select id, slug, plan, estado from gyms where slug in ('evolution-gym', 'gym-demo'))

-- inventario → ventas de producto desde caja (registrarTicketAction)
select 'inventario' as feature, g.slug, g.plan,
       count(p.id) filter (where p.fecha_pago >= periodo.desde)         as ultimos_90d,
       count(p.id)                                                       as historico,
       count(distinct p.ticket_id)                                       as detalle,  -- tickets
       min(p.fecha_pago)::date                                           as primero,
       max(p.fecha_pago)::date                                           as ultimo
from g cross join periodo
left join pagos p on p.tenant_id = g.id
                 and p.concepto = 'producto'
                 and p.anulado_at is null
group by g.slug, g.plan

union all

-- creditos → abonos a plan de pago desde caja (registrarAbonoAction).
-- Los planes creados desde la ficha del socio llevan otro concepto; van en
-- la fila siguiente porque son la misma feature.
select 'creditos (abonos desde caja)', g.slug, g.plan,
       count(pp.id) filter (where pp.created_at >= periodo.desde),
       count(pp.id),
       count(pp.id) filter (where pp.estado = 'activo'),                -- activos
       min(pp.created_at)::date, max(pp.created_at)::date
from g cross join periodo
left join planes_pago pp on pp.tenant_id = g.id and pp.concepto like 'Abono —%'
group by g.slug, g.plan

union all

select 'creditos (todos los planes de pago)', g.slug, g.plan,
       count(pp.id) filter (where pp.created_at >= periodo.desde),
       count(pp.id),
       count(pp.id) filter (where pp.estado = 'activo'),
       min(pp.created_at)::date, max(pp.created_at)::date
from g cross join periodo
left join planes_pago pp on pp.tenant_id = g.id
group by g.slug, g.plan

union all

-- kiosco_autoservicio → códigos generados en el kiosco y procesados en caja
-- (usado = true tanto si se autorizó como si se rechazó: el staff lo tocó).
select 'kiosco_autoservicio (' || coalesce(c.tipo, 'sin códigos') || ')', g.slug, g.plan,
       count(c.id) filter (where c.created_at >= periodo.desde),
       count(c.id),
       count(c.id) filter (where c.usado),                              -- procesados
       min(c.created_at)::date, max(c.created_at)::date
from g cross join periodo
left join codigos_autorizacion c on c.tenant_id = g.id
group by g.slug, g.plan, c.tipo

union all

-- Contexto, no cierre: mercadopago desde caja ya se exigía hoy.
select 'mercadopago (contexto)', g.slug, g.plan,
       count(pe.id) filter (where pe.created_at >= periodo.desde),
       count(pe.id),
       count(pe.id) filter (where pe.status = 'approved'),              -- aprobados
       min(pe.created_at)::date, max(pe.created_at)::date
from g cross join periodo
left join pagos_externos pe on pe.tenant_id = g.id and pe.proveedor = 'mercadopago'
group by g.slug, g.plan

order by 1, 2;


-- ═══════════ 2. Features del PR 4 sin uso en NINGÚN tenant vivo ═══════════
-- (todo el histórico). Cero = cierre no probado por nadie.
with g as (select id from gyms where slug in ('evolution-gym', 'gym-demo'))
select feature, uso_total,
       case when uso_total = 0 then 'SIN USO: probar a mano antes del merge'
            else 'con uso real' end as veredicto
from (
  select 'inventario (ventas de producto)' as feature,
         (select count(*) from pagos p join g on g.id = p.tenant_id
           where p.concepto = 'producto' and p.anulado_at is null) as uso_total
  union all
  select 'creditos (planes de pago)',
         (select count(*) from planes_pago pp join g on g.id = pp.tenant_id)
  union all
  select 'kiosco_autoservicio (códigos)',
         (select count(*) from codigos_autorizacion c join g on g.id = c.tenant_id)
) t
order by feature;
