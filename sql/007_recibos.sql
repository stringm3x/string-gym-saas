-- Bloque 7: Recibos de pago
-- Ejecutar en Supabase SQL Editor (o supabase db push si tienes CLI)

-- 1. Columna folio en pagos (secuencial por tenant)
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS folio bigint;

CREATE OR REPLACE FUNCTION set_pago_folio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folio IS NULL THEN
    SELECT COALESCE(MAX(folio), 0) + 1
    INTO NEW.folio
    FROM pagos
    WHERE tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pago_folio ON pagos;
CREATE TRIGGER trg_pago_folio
  BEFORE INSERT ON pagos
  FOR EACH ROW
  EXECUTE FUNCTION set_pago_folio();

-- 2. Configuración del gym (datos para el recibo)
ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS rfc text;
