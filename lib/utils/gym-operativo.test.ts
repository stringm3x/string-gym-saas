/**
 * Bloque 10: prueba_hasta es un timestamp y hoyCDMX() es medianoche de
 * México — con el historial del bug de las 18:00 (proxy.ts ya tuvo que
 * corregir una comparación que cortaba la prueba a las 18:00 hora de
 * México en vez de a medianoche), estos casos van probados, no razonados.
 * México es UTC-6 fijo (sin horario de verano desde 2022).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { gymOperativo } from "./gym-operativo";

/** Fija el reloj del sistema a un instante de pared en México (UTC-6). */
function fijarHoraMX(iso: string) {
  // "2026-06-10T10:00:00" hora de México == UTC-6 == "...T16:00:00Z".
  vi.setSystemTime(new Date(iso + "-06:00"));
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("gymOperativo: estado manda antes que la fecha", () => {
  it("activo → siempre operativo, sin importar prueba_hasta", () => {
    expect(
      gymOperativo({ estado: "activo", prueba_hasta: "2020-01-01T00:00:00Z" })
    ).toBe(true);
  });

  it("suspendido → nunca operativo", () => {
    expect(gymOperativo({ estado: "suspendido", prueba_hasta: null })).toBe(
      false
    );
  });

  it("cancelado → nunca operativo", () => {
    expect(gymOperativo({ estado: "cancelado", prueba_hasta: null })).toBe(
      false
    );
  });

  it("prueba sin prueba_hasta todavía → operativo (no se corta sin fecha)", () => {
    expect(gymOperativo({ estado: "prueba", prueba_hasta: null })).toBe(true);
  });
});

describe("gymOperativo: borde de la prueba, hora de México (bloque 10)", () => {
  it("vence hoy, consultada a las 10:00 hora de México → operativo", () => {
    // prueba_hasta guardado correctamente: medianoche de México del día que
    // vence (2026-06-10T00:00:00-06:00 == 2026-06-10T06:00:00Z).
    fijarHoraMX("2026-06-10T10:00:00");
    expect(
      gymOperativo({ estado: "prueba", prueba_hasta: "2026-06-10T06:00:00Z" })
    ).toBe(true);
  });

  it("vence hoy, consultada a las 23:00 hora de México → sigue operativo", () => {
    fijarHoraMX("2026-06-10T23:00:00");
    expect(
      gymOperativo({ estado: "prueba", prueba_hasta: "2026-06-10T06:00:00Z" })
    ).toBe(true);
  });

  it("venció ayer → no operativo, sin importar la hora a la que se consulte", () => {
    // prueba_hasta = medianoche de México del día anterior.
    fijarHoraMX("2026-06-10T08:00:00");
    expect(
      gymOperativo({ estado: "prueba", prueba_hasta: "2026-06-09T06:00:00Z" })
    ).toBe(false);
  });

  it("justo el instante en que vence (medianoche MX del día siguiente) → ya no operativo", () => {
    fijarHoraMX("2026-06-11T00:00:00");
    expect(
      gymOperativo({ estado: "prueba", prueba_hasta: "2026-06-10T06:00:00Z" })
    ).toBe(false);
  });

  it('prueba_hasta guardado como "<fecha>T00:00:00Z" — un segundo antes de medianoche MX del día anterior, todavía operativo', () => {
    // 2026-06-10T00:00:00Z == 2026-06-09T18:00:00 hora de México (el bug de
    // las 18:00: alguien guardó esto pensando "medianoche del 10", pero en
    // México esa fecha en punto es las 6pm del 9). A las 23:59:59 del 9 en
    // México (wall-clock), hoyCDMX() todavía es medianoche del 9 — y
    // 2026-06-10T00:00:00Z SÍ es >= eso, aunque el instante exacto de
    // prueba_hasta ya haya "pasado" un rato antes (a las 6pm). gymOperativo
    // compara contra el día, no cuenta el reloj en tiempo real.
    fijarHoraMX("2026-06-09T23:59:59");
    expect(
      gymOperativo({ estado: "prueba", prueba_hasta: "2026-06-10T00:00:00Z" })
    ).toBe(true);
  });

  it('mismo prueba_hasta "T00:00:00Z" — al cruzar medianoche MX del día "10", ya no operativo: el 10 entero queda tratado como vencido', () => {
    // Esto es el hallazgo real: un prueba_hasta escrito como
    // "2026-06-10T00:00:00Z" NO cubre el día 10 en México — se vence
    // apenas empieza, no al final. Guardar la fecha límite en UTC-medianoche
    // en vez de México-medianoche le quita casi un día entero de prueba al
    // gimnasio sin que se note leyendo solo la fecha.
    fijarHoraMX("2026-06-10T00:00:00");
    expect(
      gymOperativo({ estado: "prueba", prueba_hasta: "2026-06-10T00:00:00Z" })
    ).toBe(false);
  });
});
