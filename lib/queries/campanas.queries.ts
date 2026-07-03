import { createClient } from "@/lib/supabase/server";
import type { Audiencia, CampanaInput } from "@/lib/validations/campanas.schema";

export interface Destinatario {
  id: string;
  nombre: string;
  telefono: string;
  fecha_vencimiento: string | null;
}

export interface DestinatariosResult {
  destinatarios: Destinatario[];
  /** Registros que calzan la audiencia pero no tienen teléfono (excluidos). */
  sinTelefono: number;
}

export interface Campana {
  id: string;
  nombre: string;
  mensaje: string;
  audiencia: Audiencia;
  total_destinatarios: number;
  enviada_at: string | null;
  created_at: string;
}

/** Fecha local (YYYY-MM-DD) a `dias` de hoy. */
function ymd(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type MiembroRow = {
  id: string;
  nombre: string;
  telefono: string | null;
  fecha_vencimiento: string | null;
};

/** Separa por teléfono: arma destinatarios y cuenta los excluidos. */
function partirPorTelefono(
  rows: { id: string; nombre: string; telefono: string | null; fecha_vencimiento: string | null }[]
): DestinatariosResult {
  const destinatarios: Destinatario[] = [];
  let sinTelefono = 0;
  for (const r of rows) {
    if (r.telefono && r.telefono.trim()) {
      destinatarios.push({
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono.trim(),
        fecha_vencimiento: r.fecha_vencimiento,
      });
    } else {
      sinTelefono++;
    }
  }
  return { destinatarios, sinTelefono };
}

const MIEMBRO_COLS = "id, nombre, telefono, fecha_vencimiento";

/**
 * Destinatarios de una campaña según la audiencia. Excluye siempre a quienes
 * no tienen teléfono (no se les puede enviar WhatsApp) y reporta cuántos
 * quedaron fuera. Usa la misma definición de "activo/vencido" que el resto del
 * app: fecha_vencimiento vs hoy. No incluye miembros archivados.
 */
export async function getDestinatariosByAudiencia(
  tenantId: string,
  audiencia: Audiencia
): Promise<DestinatariosResult> {
  const supabase = await createClient();
  const hoy = ymd(0);

  if (audiencia === "prospectos") {
    const { data } = await supabase
      .from("prospectos")
      .select("id, nombre, telefono")
      .eq("tenant_id", tenantId)
      .not("estado", "in", "(convertido,descartado)")
      .order("created_at", { ascending: false });
    return partirPorTelefono(
      (data ?? []).map((p) => ({ ...p, fecha_vencimiento: null }))
    );
  }

  if (audiencia === "sin_actividad_14d") {
    // Activos sin ningún check-in en los últimos 14 días.
    const { data: activos } = await supabase
      .from("miembros")
      .select(MIEMBRO_COLS)
      .eq("tenant_id", tenantId)
      .eq("archivado", false)
      .gte("fecha_vencimiento", hoy);

    const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: checkins } = await supabase
      .from("checkins")
      .select("miembro_id")
      .eq("tenant_id", tenantId)
      .gte("fecha_hora", desde);
    const conActividad = new Set(
      (checkins ?? []).map((c) => c.miembro_id).filter(Boolean)
    );

    const sinAct = ((activos ?? []) as MiembroRow[]).filter(
      (m) => !conActividad.has(m.id)
    );
    return partirPorTelefono(sinAct);
  }

  // Resto de audiencias: filtros sobre miembros por fecha_vencimiento.
  let q = supabase
    .from("miembros")
    .select(MIEMBRO_COLS)
    .eq("tenant_id", tenantId)
    .eq("archivado", false);

  if (audiencia === "todos_activos") {
    q = q.gte("fecha_vencimiento", hoy);
  } else if (audiencia === "por_vencer_7d") {
    q = q.gte("fecha_vencimiento", hoy).lte("fecha_vencimiento", ymd(7));
  } else if (audiencia === "por_vencer_30d") {
    q = q.gte("fecha_vencimiento", hoy).lte("fecha_vencimiento", ymd(30));
  } else if (audiencia === "vencidos") {
    q = q.lt("fecha_vencimiento", hoy);
  }

  const { data } = await q.order("fecha_vencimiento", { ascending: true });
  return partirPorTelefono((data ?? []) as MiembroRow[]);
}

/** Registra una campaña como enviada. */
export async function createCampana(
  tenantId: string,
  input: CampanaInput,
  totalDestinatarios: number,
  userId: string
): Promise<{ ok: true; campana: Campana } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campanas")
    .insert({
      tenant_id: tenantId,
      nombre: input.nombre,
      mensaje: input.mensaje,
      audiencia: input.audiencia,
      total_destinatarios: totalDestinatarios,
      enviada_at: new Date().toISOString(),
      creada_by: userId,
    })
    .select(
      "id, nombre, mensaje, audiencia, total_destinatarios, enviada_at, created_at"
    )
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear la campaña." };
  }
  return { ok: true, campana: data as Campana };
}

/** Historial de campañas del tenant (máx. 50, más recientes primero). */
export async function getCampanas(tenantId: string): Promise<Campana[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campanas")
    .select(
      "id, nombre, mensaje, audiencia, total_destinatarios, enviada_at, created_at"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Campana[];
}
