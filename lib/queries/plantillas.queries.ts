import { createClient } from "@/lib/supabase/server";
import type { PlantillaCategoria, PlantillaInput } from "@/lib/validations/plantilla.schema";

export type { PlantillaCategoria };

export interface PlantillaMensaje {
  id: string;
  tenant_id: string;
  nombre: string;
  categoria: PlantillaCategoria;
  contenido: string;
  activo: boolean;
  created_at: string;
}

export async function listPlantillas(
  tenantId: string,
  options?: { categoria?: PlantillaCategoria; soloActivas?: boolean }
): Promise<PlantillaMensaje[]> {
  const supabase = await createClient();
  let query = supabase
    .from("plantillas_mensaje")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");

  if (options?.categoria) {
    query = query.eq("categoria", options.categoria);
  }
  if (options?.soloActivas !== false) {
    query = query.eq("activo", true);
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function createPlantilla(
  tenantId: string,
  input: PlantillaInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plantillas_mensaje")
    .insert({ tenant_id: tenantId, ...input })
    .select("id")
    .single();

  if (error || !data)
    return { ok: false, error: error?.message ?? "No se pudo crear la plantilla" };
  return { ok: true, id: data.id };
}

export async function updatePlantilla(
  tenantId: string,
  id: string,
  input: PlantillaInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plantillas_mensaje")
    .update(input)
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deletePlantilla(
  tenantId: string,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plantillas_mensaje")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleActivoPlantilla(
  tenantId: string,
  id: string,
  activo: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plantillas_mensaje")
    .update({ activo })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const PLANTILLAS_SEED: Omit<PlantillaInput, "activo">[] = [
  {
    nombre: "Recordatorio vencimiento",
    categoria: "miembro_por_vencer",
    contenido:
      "Hola {{nombre}}, tu membresía en {{gym_nombre}} vence el {{fecha_vencimiento}}. Te esperamos para renovar.",
  },
  {
    nombre: "Te extrañamos",
    categoria: "miembro_vencido",
    contenido:
      "Hola {{nombre}}, hace tiempo no te vemos en {{gym_nombre}}. ¿Volvemos a verte esta semana?",
  },
  {
    nombre: "Bienvenida prospecto",
    categoria: "prospecto",
    contenido:
      "Hola {{nombre}}, gracias por interesarte en {{gym_nombre}}. ¿Te agendamos tu clase de prueba?",
  },
  {
    nombre: "Promo del mes",
    categoria: "general",
    contenido:
      "Hola {{nombre}}, este mes tenemos promociones especiales en {{gym_nombre}}. ¿Te platico?",
  },
];

export async function seedPlantillas(
  tenantId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const rows = PLANTILLAS_SEED.map((p) => ({
    tenant_id: tenantId,
    ...p,
    activo: true,
  }));

  const { error } = await supabase.from("plantillas_mensaje").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: rows.length };
}
