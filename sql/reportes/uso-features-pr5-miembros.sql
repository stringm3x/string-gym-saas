-- ─────────────────────────────────────────────────────────────────────────
-- REPORTE (solo lectura, NO es migración): uso real por feature y por gym
-- de lo que el PR 5 (migración de miembros/ + miembros/[id]/ a panelAction)
-- empieza a exigir. Mismo formato que uso-features-pr4-caja.sql.
--
-- Las 21 acciones de la carpeta y lo que declaran:
--   miembros/actions.ts (6)
--     crear / editar / notas legacy      miembros (Starter) + crear/editar_miembros
--       └ con tag_ids en el form          + has("tags") en el cuerpo      ← CIERRA tags (Pro)
--     archivar / restaurar               archivar_miembros (Starter) + eliminar_archivar_miembros
--     bulkAsignarTag                     bulk_actions (Pro) + editar_miembros; cuerpo has("tags")
--                                                                          ← CIERRA bulk_actions + tags
--   miembros/importar/actions.ts (2)     importacion_csv (Starter) + configurar_general
--     parsearCSV / importarMiembros      hoy `role === "owner"` a mano → owner + gerente
--   miembros/[id]/membresia-actions.ts (6)
--     congelar / descongelar / aprobar / rechazar   miembros (Starter) + editar_miembros
--     previsualizarCambioPlan / cambiarPlan          catalogo_planes (Starter) + registrar_pagos
--   miembros/[id]/renovar-actions.ts (1) caja_basica (Starter) + registrar_pagos
--   miembros/[id]/creditos-actions.ts (2) creditos (Pro) + registrar_pagos — ya verificaba ambos
--   miembros/[id]/nutricion-actions.ts (3) nutricion (Escala) + gestionar_nutricion — ya verificaba ambos
--   miembros/qr-actions.ts (1)           qr_access (Starter); hoy `role === "owner"` a mano
--                                        (ver nota en el PR: no existe permiso "solo owner")
--
-- Cierres NUEVOS de plan en este PR: `tags` y `bulk_actions` (ambas Pro).
-- creditos y nutricion ya se exigían; lo demás es Starter.
-- ─────────────────────────────────────────────────────────────────────────

-- ═══════════════ 1. Uso por feature, gym y periodo (90 días) ═══════════════
with periodo as (select now() - interval '90 days' as desde),
g as (select id, slug, plan, estado from gyms where slug in ('evolution-gym', 'gym-demo'))

-- tags (CIERRA) → etiquetas definidas por el gym
select 'tags (etiquetas definidas)' as feature, g.slug, g.plan,
       null::bigint                                                      as ultimos_90d,  -- tags no tiene fecha
       count(t.id)                                                       as historico,
       null::bigint                                                      as detalle,
       null::date as primero, null::date as ultimo
from g cross join periodo
left join tags t on t.tenant_id = g.id
group by g.slug, g.plan

union all

-- tags (CIERRA) → socios etiquetados (lo que tocan crear/editar/bulk)
select 'tags (socios etiquetados)', g.slug, g.plan,
       null::bigint,
       count(mt.miembro_id),
       count(distinct mt.miembro_id),                                     -- socios distintos
       null::date, null::date
from g cross join periodo
left join miembros_tags mt on mt.tenant_id = g.id
group by g.slug, g.plan

union all

-- creditos (ya se exigía; contexto) → planes de pago y cuotas cobradas
select 'creditos (contexto)', g.slug, g.plan,
       count(pp.id) filter (where pp.created_at >= periodo.desde),
       count(pp.id),
       (select count(*) from cuotas_pago c where c.tenant_id = g.id and c.pagado_at is not null), -- cuotas pagadas
       min(pp.created_at)::date, max(pp.created_at)::date
from g cross join periodo
left join planes_pago pp on pp.tenant_id = g.id
group by g.slug, g.plan, g.id

union all

-- nutricion (ya se exigía; contexto)
select 'nutricion (contexto)', g.slug, g.plan,
       count(pn.id) filter (where pn.created_at >= periodo.desde),
       count(pn.id),
       count(pn.id) filter (where pn.activo),                             -- activos
       min(pn.created_at)::date, max(pn.created_at)::date
from g cross join periodo
left join planes_nutricion pn on pn.tenant_id = g.id
group by g.slug, g.plan

union all

-- Starter, no cierra — pero mide qué tan usadas están las acciones que
-- ganan permiso (importar) o que hoy son "solo owner" (QR).
select 'congelaciones (Starter, no cierra)', g.slug, g.plan,
       count(e.id) filter (where e.created_at >= periodo.desde),
       count(e.id),
       count(e.id) filter (where e.estado = 'activa'),                    -- activas
       min(e.created_at)::date, max(e.created_at)::date
from g cross join periodo
left join miembro_eventos e on e.tenant_id = g.id and e.tipo = 'congelacion'
group by g.slug, g.plan

union all

select 'cambios de plan (Starter, no cierra)', g.slug, g.plan,
       count(e.id) filter (where e.created_at >= periodo.desde),
       count(e.id),
       null::bigint,
       min(e.created_at)::date, max(e.created_at)::date
from g cross join periodo
left join miembro_eventos e on e.tenant_id = g.id and e.tipo = 'cambio_plan'
group by g.slug, g.plan

union all

select 'importacion CSV (Starter; hoy solo owner)', g.slug, g.plan,
       null::bigint,
       count(m.id),
       count(distinct m.origen_importacion),                              -- lotes distintos
       null::date, null::date
from g cross join periodo
left join miembros m on m.tenant_id = g.id and m.origen_importacion is not null
group by g.slug, g.plan

order by 1, 2;


-- ═══════════ 2. Features que el PR 5 CIERRA sin uso en ningún tenant ═══════════
with g as (select id from gyms where slug in ('evolution-gym', 'gym-demo'))
select feature, uso_total,
       case when uso_total = 0 then 'SIN USO: probar a mano antes del merge'
            else 'con uso real' end as veredicto
from (
  select 'tags (etiquetas + socios etiquetados)' as feature,
         (select count(*) from tags t join g on g.id = t.tenant_id)
       + (select count(*) from miembros_tags mt join g on g.id = mt.tenant_id) as uso_total
  union all
  select 'bulk_actions (no deja rastro propio: se prueba a mano sí o sí)', 0::bigint
) t
order by feature;
