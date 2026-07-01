-- 033_exportar_datos.sql — Exportación de datos al cancelar (Fase 7.3, Bloque 3)
-- ⚠️ NO APLICADA. Carlos la valida y corre manualmente.
--
-- El plan asumía que `gyms.exportar_datos_pendiente` ya existía (Fase 7.4),
-- pero no está en el esquema. Se agrega aquí. Semántica: true = hay un export
-- pendiente de enviar al owner (p. ej. el email de export falló al cancelar);
-- la acción de cancelar lo pone en false cuando el ZIP se envía con éxito.

alter table gyms
  add column if not exists exportar_datos_pendiente boolean not null default false;
