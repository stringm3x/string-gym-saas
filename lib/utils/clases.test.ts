import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Clase, ClaseReserva } from "@/lib/types/clases";
import {
  generarSesionesPara,
  calcularHoraFin,
} from "./clases-generador";

// Las queries se mockean para probar la lógica de cupo sin tocar la DB.
vi.mock("@/lib/queries/clases.queries", () => ({
  createReserva: vi.fn(),
  getReservasBySesion: vi.fn(),
  confirmarReserva: vi.fn(),
}));

import {
  decideEstadoReserva,
  primeraEnEspera,
  reservarConCupo,
  promoverListaEspera,
} from "./clases-cupo";
import {
  createReserva,
  getReservasBySesion,
  confirmarReserva,
} from "@/lib/queries/clases.queries";

function mkClase(partial: Partial<Clase> = {}): Clase {
  return {
    id: "clase-1",
    tenant_id: "t1",
    nombre: "Box Matutino",
    descripcion: null,
    instructor: "Ana",
    color: "#10b981",
    tipo: "regular",
    duracion_minutos: 60,
    cupo_maximo: 15,
    es_recurrente: true,
    dias_semana: [1, 3, 5],
    hora_inicio: "07:00:00",
    fecha_inicio: "2026-01-01",
    fecha_fin: null,
    activa: true,
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function mkReserva(partial: Partial<ClaseReserva>): ClaseReserva {
  return {
    id: "r",
    tenant_id: "t1",
    sesion_id: "s1",
    miembro_id: null,
    prospecto_id: null,
    nombre_visitante: null,
    telefono_visitante: null,
    estado: "confirmada",
    check_in_at: null,
    check_in_by: null,
    origen: "manual",
    created_at: "2026-06-01T10:00:00Z",
    ...partial,
  };
}

const weekday = (ymd: string) => new Date(ymd + "T00:00:00Z").getUTCDay();
const DESDE = new Date("2026-06-15T12:00:00Z");

describe("generarSesionesPara", () => {
  it("recurrente Lun/Mié/Vie → solo esos días, todos presentes", () => {
    const sesiones = generarSesionesPara(mkClase(), 4, DESDE);
    expect(sesiones.length).toBeGreaterThan(0);
    // Todos los días caen en {1,3,5}…
    expect(sesiones.every((s) => [1, 3, 5].includes(weekday(s.fecha)))).toBe(
      true
    );
    // …y aparecen los tres (ninguno faltante ni extra).
    expect(new Set(sesiones.map((s) => weekday(s.fecha)))).toEqual(
      new Set([1, 3, 5])
    );
    // Ordenadas y dentro del rango [hoy, hoy+28d].
    const fechas = sesiones.map((s) => s.fecha);
    expect([...fechas].sort()).toEqual(fechas);
    expect(fechas[0] >= "2026-06-15").toBe(true);
  });

  it("respeta fecha_fin (no genera después)", () => {
    const sesiones = generarSesionesPara(
      mkClase({ fecha_fin: "2026-06-19" }),
      4,
      DESDE
    );
    expect(sesiones.length).toBeGreaterThan(0);
    expect(sesiones.every((s) => s.fecha <= "2026-06-19")).toBe(true);
  });

  it("no recurrente → exactamente 1 sesión en fecha_inicio", () => {
    const sesiones = generarSesionesPara(
      mkClase({ es_recurrente: false, fecha_inicio: "2026-07-10" }),
      4,
      DESDE
    );
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].fecha).toBe("2026-07-10");
  });

  it("hora_fin = hora_inicio + duración", () => {
    expect(calcularHoraFin("07:00:00", 90)).toBe("08:30:00");
    const sesiones = generarSesionesPara(
      mkClase({ duracion_minutos: 45, hora_inicio: "06:15:00" }),
      1,
      DESDE
    );
    expect(sesiones[0].hora_fin).toBe("07:00:00");
  });
});

describe("decideEstadoReserva", () => {
  it("cupo > 0 → confirmada", () => {
    expect(decideEstadoReserva(3)).toBe("confirmada");
  });
  it("cupo = 0 → en_lista_espera", () => {
    expect(decideEstadoReserva(0)).toBe("en_lista_espera");
  });
});

describe("primeraEnEspera", () => {
  it("devuelve la más antigua en lista de espera", () => {
    const reservas = [
      mkReserva({ id: "a", estado: "confirmada" }),
      mkReserva({
        id: "b",
        estado: "en_lista_espera",
        created_at: "2026-06-03T10:00:00Z",
      }),
      mkReserva({
        id: "c",
        estado: "en_lista_espera",
        created_at: "2026-06-02T10:00:00Z",
      }),
    ];
    expect(primeraEnEspera(reservas)?.id).toBe("c");
  });
  it("lista vacía / sin espera → null", () => {
    expect(primeraEnEspera([])).toBeNull();
    expect(primeraEnEspera([mkReserva({ estado: "confirmada" })])).toBeNull();
  });
});

describe("reservarConCupo (delega en createReserva)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cupo disponible → confirmada (enListaEspera false)", async () => {
    vi.mocked(createReserva).mockResolvedValue({
      reserva: mkReserva({ estado: "confirmada" }),
      enListaEspera: false,
    });
    const r = await reservarConCupo("t1", "s1", { miembroId: "m1" });
    expect(createReserva).toHaveBeenCalledWith(
      "t1",
      "s1",
      { miembroId: "m1" },
      undefined
    );
    expect(r.enListaEspera).toBe(false);
    expect(r.reserva?.estado).toBe("confirmada");
  });

  it("sin cupo → en_lista_espera (enListaEspera true)", async () => {
    vi.mocked(createReserva).mockResolvedValue({
      reserva: mkReserva({ estado: "en_lista_espera" }),
      enListaEspera: true,
    });
    const r = await reservarConCupo("t1", "s1", {});
    expect(r.enListaEspera).toBe(true);
    expect(r.reserva?.estado).toBe("en_lista_espera");
  });
});

describe("promoverListaEspera", () => {
  beforeEach(() => vi.clearAllMocks());

  it("promueve la primera en espera a confirmada", async () => {
    const espera = mkReserva({
      id: "c",
      estado: "en_lista_espera",
      created_at: "2026-06-02T10:00:00Z",
    });
    vi.mocked(getReservasBySesion).mockResolvedValue([
      mkReserva({ id: "a", estado: "confirmada" }),
      espera,
    ]);
    vi.mocked(confirmarReserva).mockResolvedValue({
      reserva: { ...espera, estado: "confirmada" },
    });

    const r = await promoverListaEspera("t1", "s1");
    expect(getReservasBySesion).toHaveBeenCalledWith("t1", "s1", undefined);
    expect(confirmarReserva).toHaveBeenCalledWith("t1", "c", undefined);
    expect(r?.id).toBe("c");
    expect(r?.estado).toBe("confirmada");
  });

  it("lista vacía → null (no confirma nada)", async () => {
    vi.mocked(getReservasBySesion).mockResolvedValue([
      mkReserva({ estado: "confirmada" }),
    ]);
    const r = await promoverListaEspera("t1", "s1");
    expect(r).toBeNull();
    expect(confirmarReserva).not.toHaveBeenCalled();
  });
});
