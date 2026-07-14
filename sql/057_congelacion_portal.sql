-- 057_congelacion_portal.sql — Solicitud de congelación desde el portal (D7)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente en Supabase.
--
-- El socio solicita congelar desde el portal. Si el gym auto-aprueba, se aplica
-- de inmediato; si no, queda 'solicitada' y el dueño la aprueba/rechaza desde
-- la ficha.

-- Nuevo estado 'solicitada' para las congelaciones (miembro_eventos).
alter table miembro_eventos
  drop constraint if exists miembro_eventos_estado_check;

alter table miembro_eventos
  add constraint miembro_eventos_estado_check
  check (estado in ('activa', 'cancelada', 'solicitada'));

-- Auto-aprobar solicitudes de congelación del portal.
alter table gyms
  add column if not exists congelacion_auto_aprobar boolean not null default false;
