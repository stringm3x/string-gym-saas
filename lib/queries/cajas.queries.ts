import { createClient } from "@/lib/supabase/server";

export interface Caja {
  id: string;
  tenant_id: string;
  nombre: string;
  es_default: boolean;
  activa: boolean;
  /** Si esta caja cuadra su propio efectivo (fondo + conteo) — apagado por
   * default: solo tiene sentido si el dinero de esa caja está separado
   * físicamente. Con esto apagado, la caja solo categoriza ventas. */
  requiere_cuadre: boolean;
  created_at: string;
}

/** Cajas activas del gym, la default primero. */
export async function listCajas(tenantId: string): Promise<Caja[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cajas")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("activa", true)
    .order("es_default", { ascending: false })
    .order("nombre", { ascending: true });
  return (data ?? []) as Caja[];
}

/** Todas las cajas del gym (incluye desactivadas) — para el manager. */
export async function listCajasTodas(tenantId: string): Promise<Caja[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cajas")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("es_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []) as Caja[];
}

/** La caja donde caen los pagos sin punto de venta físico (portal, kiosco,
 * MercadoPago, cuotas de crédito…). Siempre existe (se crea con el gym). */
export async function getCajaDefault(tenantId: string): Promise<Caja | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cajas")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("es_default", true)
    .maybeSingle();
  return (data as Caja | null) ?? null;
}

export async function createCaja(
  tenantId: string,
  nombre: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return { ok: false, error: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cajas")
    .insert({ tenant_id: tenantId, nombre: nombreLimpio, es_default: false })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear la caja." };
  }
  return { ok: true, id: data.id as string };
}

export async function renameCaja(
  tenantId: string,
  cajaId: string,
  nombre: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return { ok: false, error: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cajas")
    .update({ nombre: nombreLimpio })
    .eq("tenant_id", tenantId)
    .eq("id", cajaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Desactiva una caja — no se puede borrar la default ni una con turno abierto. */
export async function desactivarCaja(
  tenantId: string,
  cajaId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: caja } = await supabase
    .from("cajas")
    .select("es_default")
    .eq("tenant_id", tenantId)
    .eq("id", cajaId)
    .maybeSingle();
  if (!caja) return { ok: false, error: "Caja no encontrada." };
  if (caja.es_default) {
    return { ok: false, error: "No se puede desactivar la caja default." };
  }

  const { data: turnoAbierto } = await supabase
    .from("cortes_caja")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("caja_id", cajaId)
    .eq("estado", "abierto")
    .maybeSingle();
  if (turnoAbierto) {
    return { ok: false, error: "Esta caja tiene un turno abierto — ciérralo primero." };
  }

  const { error } = await supabase
    .from("cajas")
    .update({ activa: false })
    .eq("tenant_id", tenantId)
    .eq("id", cajaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reactivarCaja(
  tenantId: string,
  cajaId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cajas")
    .update({ activa: true })
    .eq("tenant_id", tenantId)
    .eq("id", cajaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Prende/apaga si una caja cuadra su propio efectivo (fondo + conteo). */
export async function toggleRequiereCuadre(
  tenantId: string,
  cajaId: string,
  requiereCuadre: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  if (!requiereCuadre) {
    const { data: turnoAbierto } = await supabase
      .from("cortes_caja")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("caja_id", cajaId)
      .eq("estado", "abierto")
      .maybeSingle();
    if (turnoAbierto) {
      return {
        ok: false,
        error: "Esta caja tiene un turno abierto — ciérralo primero.",
      };
    }
  }

  const { error } = await supabase
    .from("cajas")
    .update({ requiere_cuadre: requiereCuadre })
    .eq("tenant_id", tenantId)
    .eq("id", cajaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * A qué caja pertenece una venta: la del producto si tiene una asignada, si
 * no la caja default del gym — así el cajero nunca elige manualmente dónde
 * cobrar, el sistema lo resuelve solo según qué se vendió.
 */
export async function resolverCajaDeVenta(
  tenantId: string,
  productoId?: string | null
): Promise<string | null> {
  const supabase = await createClient();

  if (productoId) {
    const { data } = await supabase
      .from("productos")
      .select("caja_id")
      .eq("tenant_id", tenantId)
      .eq("id", productoId)
      .maybeSingle();
    if (data?.caja_id) return data.caja_id as string;
  }

  const { data: def } = await supabase
    .from("cajas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("es_default", true)
    .maybeSingle();
  return (def?.id as string | undefined) ?? null;
}
