/**
 * Bloque 10: define "operativo" en un solo lugar. Antes cada superficie que
 * quería saber si un gym podía operar reinventaba la cuenta — proxy.ts tenía
 * su propia versión (la única real, y solo para el panel de staff),
 * admin.queries.ts otras dos para KPIs — y kiosco, portal, la API pública,
 * el cron de WhatsApp y el webhook entrante de WhatsApp no la tenían en
 * absoluto: un gym suspendido o con la prueba vencida seguía dando entradas
 * y cobrando fuera del panel.
 *
 * Sin margen de gracia: el corte es el mismo que proxy.ts ya usaba (hoyCDMX,
 * medianoche de México — el último día de prueba se usa completo, se corta
 * al entrar el día siguiente). El webhook de MercadoPago NO usa esto — un
 * pago que ya se movió se registra sin importar el estado del gym (mismo
 * argumento que "el pago sin caja default" del bloque 3).
 */
import { hoyCDMX, hoyISO, isoEnMX } from "@/lib/utils/dates";

export interface GymEstadoPrueba {
  estado: string;
  prueba_hasta: string | null;
}

export function gymOperativo(gym: GymEstadoPrueba): boolean {
  if (gym.estado === "suspendido" || gym.estado === "cancelado") return false;
  if (gym.estado === "prueba" && gym.prueba_hasta) {
    // prueba_hasta es un instante real (timestamptz): comparar instantes es
    // correcto sin importar en qué huso horario se haya escrito el valor
    // (ver el test del caso guardado como "<fecha>T00:00:00Z" — ese SÍ
    // corta casi un día antes de lo que la fecha sugiere a simple vista,
    // porque medianoche UTC es las 18:00 del día anterior en México; el
    // bug no está en esta comparación, está en cómo se guardó el valor).
    return new Date(gym.prueba_hasta) >= hoyCDMX();
  }
  return true; // activo, o prueba sin prueba_hasta todavía (no se corta sin fecha)
}

/**
 * Días de calendario (México) que faltan para que venza la prueba. 0 el día
 * en que vence (todavía operativo ese día completo, ver gymOperativo),
 * negativo si ya venció. Para el banner de "te quedan N días" — no para
 * decidir acceso, eso lo hace gymOperativo con el instante real.
 */
export function diasRestantesPrueba(prueba_hasta: string): number {
  const hoy = hoyISO();
  const vence = isoEnMX(prueba_hasta);
  return Math.round(
    (new Date(vence + "T00:00:00Z").getTime() -
      new Date(hoy + "T00:00:00Z").getTime()) /
      86_400_000
  );
}
