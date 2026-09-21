/**
 * Bloque 07: lógica de clases que no se puede verificar a mano sin dejar
 * datos de prueba reales (sesiones/reservas) en un gym, o sin arriesgar
 * sobrevender/cancelar cupo de socios reales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/queries/checkins.queries", () => ({
  registrarCheckinPorClase: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { registrarCheckinPorClase } from "@/lib/queries/checkins.queries";
import {
  deshacerAsistencia,
  limpiarSesionesFuturasSinReservas,
  cancelarSesion,
  checkInReserva,
} from "./clases.queries";

const ERROR = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
  vi.mocked(registrarCheckinPorClase).mockReset();
});

describe("deshacerAsistencia: no sobrevender un cupo que ya se ocupó", () => {
  it("no hay cupo (ya se ocupó) → rechaza, no llega a tocar la reserva", async () => {
    const from = vi
      .fn()
      // 1. clases_reservas.select (la reserva)
      .mockReturnValueOnce(
        supaResult({ data: { id: "r1", sesion_id: "s1", estado: "no_asistio", miembro_id: "m1" } })
      )
      // 2. clases_sesiones.select (cupo_disponible) → 0
      .mockReturnValueOnce(supaResult({ data: { cupo_disponible: 0 } }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await deshacerAsistencia("t1", "r1");

    expect(r.ok).toBe(false);
    expect(r.error).toContain("No hay cupo");
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("hay cupo → confirma de vuelta, sin advertencia si era no_asistio", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(
        supaResult({ data: { id: "r1", sesion_id: "s1", estado: "no_asistio", miembro_id: "m1" } })
      )
      .mockReturnValueOnce(supaResult({ data: { cupo_disponible: 1 } }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await deshacerAsistencia("t1", "r1");

    expect(r).toEqual({ ok: true, advertencia: undefined });
  });

  it("era 'asistió' de un socio → advierte que el saldo de visitas no se ajusta solo", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(
        supaResult({ data: { id: "r1", sesion_id: "s1", estado: "asistio", miembro_id: "m1" } })
      )
      .mockReturnValueOnce(supaResult({ data: { cupo_disponible: 1 } }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await deshacerAsistencia("t1", "r1");

    expect(r.ok).toBe(true);
    expect(r.advertencia).toContain("revisa su saldo");
  });

  it("la reserva ya está 'confirmada' (nada que deshacer) → rechaza sin tocar cupo", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(
        supaResult({ data: { id: "r1", sesion_id: "s1", estado: "confirmada", miembro_id: "m1" } })
      );
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await deshacerAsistencia("t1", "r1");

    expect(r.ok).toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("limpiarSesionesFuturasSinReservas: nunca le mueve el horario a quien ya se anotó", () => {
  it("cancela las sesiones futuras vacías, deja intactas las que tienen reservas", async () => {
    const from = vi
      .fn()
      // 1. clases_sesiones.select con reservas anidadas
      .mockReturnValueOnce(
        supaResult({
          data: [
            { id: "s-vacia", reservas: [] },
            { id: "s-cancelada-previa", reservas: [{ estado: "cancelada" }] },
            { id: "s-con-gente", reservas: [{ estado: "confirmada" }] },
            { id: "s-con-espera", reservas: [{ estado: "en_lista_espera" }] },
          ],
        })
      )
      // 2. clases_sesiones.update (cancelar las vacías)
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await limpiarSesionesFuturasSinReservas("t1", "clase-1", "2026-06-01");

    // Las dos primeras (sin reservas activas) se cancelan; las dos últimas no.
    expect(r).toEqual({ canceladas: 2, conReservas: 2 });
  });

  it("todas tienen reservas → no llama al update, conReservas cuenta todas", async () => {
    const from = vi.fn().mockReturnValueOnce(
      supaResult({
        data: [{ id: "s1", reservas: [{ estado: "confirmada" }] }],
      })
    );
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await limpiarSesionesFuturasSinReservas("t1", "clase-1", "2026-06-01");

    expect(r).toEqual({ canceladas: 0, conReservas: 1 });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("el update de limpieza falla → logError, no revienta, canceladas:0", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: [{ id: "s-vacia", reservas: [] }] }))
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await limpiarSesionesFuturasSinReservas("t1", "clase-1", "2026-06-01");

    expect(r).toEqual({ canceladas: 0, conReservas: 0 });
    expect(logError).toHaveBeenCalledWith(
      "clases.limpiar_sesiones_futuras_fallo",
      expect.objectContaining({ tenantId: "t1", claseId: "clase-1" })
    );
  });
});

describe("cancelarSesion: cascada a las reservas (bloque 07)", () => {
  it("cancela la sesión y sus reservas activas", async () => {
    const from = vi
      .fn()
      // 1. clases_sesiones.update
      .mockReturnValueOnce(supaResult({ error: null }))
      // 2. clases_reservas.update (cascada)
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await cancelarSesion("t1", "s1");

    expect(r).toEqual({ ok: true });
    expect(from).toHaveBeenCalledTimes(2);
    expect(logError).not.toHaveBeenCalled();
  });

  it("la sesión se cancela pero la cascada a reservas falla → logError, sigue ok:true", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await cancelarSesion("t1", "s1");

    expect(r).toEqual({ ok: true });
    expect(logError).toHaveBeenCalledWith(
      "clases.cancelar_sesion_reservas_fallo",
      expect.objectContaining({ tenantId: "t1", sesionId: "s1" })
    );
  });
});

describe("checkInReserva: asistir a clase cuenta como visita del socio (bloque 07)", () => {
  it("reserva de un socio → dispara registrarCheckinPorClase", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: { miembro_id: "m1" }, error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await checkInReserva("t1", "r1", "staff-1");

    expect(r).toEqual({ ok: true });
    expect(registrarCheckinPorClase).toHaveBeenCalledWith("t1", "m1", expect.anything());
  });

  it("reserva de un visitante (sin miembro_id) → no dispara check-in del gym", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: { miembro_id: null }, error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await checkInReserva("t1", "r1", "staff-1");

    expect(registrarCheckinPorClase).not.toHaveBeenCalled();
  });
});
