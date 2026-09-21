/**
 * Bloque 07: asistir a una clase ahora puede generar un check-in real del
 * gym (cuenta para el plan por visitas y la alerta de 14 días). El caso que
 * no se puede probar a mano sin arriesgar el saldo real de un socio es la
 * deduplicación: dos clases el mismo día no deben descontar dos visitas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/whatsapp/emit", () => ({ emitVisitasBajas: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { checkinHoy, registrarCheckinPorClase } from "./checkins.queries";

const ERROR = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("checkinHoy", () => {
  it("count > 0 → true", async () => {
    const from = vi.fn().mockReturnValueOnce(supaResult({ count: 1 }));
    const r = await checkinHoy("t1", "m1", clienteCon(from));
    expect(r).toBe(true);
  });

  it("count 0 → false", async () => {
    const from = vi.fn().mockReturnValueOnce(supaResult({ count: 0 }));
    const r = await checkinHoy("t1", "m1", clienteCon(from));
    expect(r).toBe(false);
  });
});

describe("registrarCheckinPorClase: una visita por día, no una por clase", () => {
  it("ya tiene check-in hoy → no crea uno segundo ni toca visitas_restantes", async () => {
    const from = vi
      .fn()
      // 1. checkinHoy → ya hay uno
      .mockReturnValueOnce(supaResult({ count: 1 }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await registrarCheckinPorClase("t1", "m1", clienteCon(from));

    // Ninguna llamada más allá del checkinHoy: nunca llega a insertar.
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("sin check-in hoy → crea uno (createCheckin corre)", async () => {
    const from = vi
      .fn()
      // 1. checkinHoy → ninguno todavía
      .mockReturnValueOnce(supaResult({ count: 0 }))
      // 2. checkins.insert (createCheckin)
      .mockReturnValueOnce(
        supaResult({ data: { id: "chk-1", fecha_hora: "2026-06-01T10:00:00Z" }, error: null })
      )
      // 3. miembros.select (visitas_restantes) → plan por tiempo, no por visitas
      .mockReturnValueOnce(supaResult({ data: { visitas_restantes: null } }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await registrarCheckinPorClase("t1", "m1", clienteCon(from));

    expect(from).toHaveBeenCalledTimes(3);
    expect(logError).not.toHaveBeenCalled();
  });

  it("createCheckin falla → logError, no lanza (la clase ya se registró, esto es secundario)", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ count: 0 }))
      .mockReturnValueOnce(supaResult({ data: null, error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await registrarCheckinPorClase("t1", "m1", clienteCon(from));

    expect(logError).toHaveBeenCalledWith(
      "clases.checkin_por_clase_fallo",
      expect.objectContaining({ tenantId: "t1", miembroId: "m1" })
    );
  });
});
