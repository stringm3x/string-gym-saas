/**
 * Cron de regeneración de sesiones de clases (Bug #8).
 *
 * Las clases recurrentes generan sus sesiones en una ventana de 4 semanas. Sin
 * regeneración, la ventana se agota y la clase "desaparece" del calendario tras
 * ~1 mes. Este job corre diario y vuelve a generar las próximas 4 semanas de
 * cada clase recurrente activa; el upsert idempotente (onConflict
 * clase_id,fecha,hora_inicio) solo crea las fechas nuevas.
 *
 * Sin sesión: usa admin client (service-role), scopeado por tenant_id en cada
 * insert. Cada clase va en try/catch: una que falle no aborta el resto.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getClasesRecurrentesActivas,
  insertSesiones,
} from "@/lib/queries/clases.queries";
import { generarSesionesPara } from "@/lib/utils/clases-generador";

export async function runClasesCron(): Promise<{
  clases: number;
  sesiones: number;
}> {
  const admin = createAdminClient();
  const clases = await getClasesRecurrentesActivas(admin);

  let sesiones = 0;
  for (const clase of clases) {
    try {
      const nuevas = generarSesionesPara(clase, 4);
      const { insertadas } = await insertSesiones(clase.tenant_id, nuevas, admin);
      sesiones += insertadas;
    } catch (err) {
      console.error("[cron clases] clase", clase.id, err);
    }
  }

  return { clases: clases.length, sesiones };
}
