/**
 * Bloque 05 (observabilidad): estos son escrituras de vigencia que antes no
 * revisaban `error` — no se pueden verificar a mano sin romper datos reales
 * (forzar que un UPDATE de Supabase falle en producción), así que el test
 * es la única verificación honesta de que ahora si fallan, no se pierden en
 * silencio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/queries/notas-credito.queries", () => ({ crearNotaCredito: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import {
  congelarMembresia,
  descongelarMembresia,
  solicitarCongelacionPortal,
  aprobarCongelacion,
} from "./miembro-eventos.queries";

const ERROR_VIGENCIA = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("congelarMembresia: si extenderVencimiento falla, no se inserta el evento", () => {
  it("falla el update de fecha_vencimiento → ok:false, sin insert, logError", async () => {
    const insert = vi.fn();
    const from = vi
      .fn()
      // 1. miembros.select (fecha_vencimiento actual)
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-01-01" } }))
      // 2. miembros.update (revert) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR_VIGENCIA }))
      // Si el código llegara a insertar el evento, este mock lo revelaría.
      .mockReturnValueOnce({ insert });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await congelarMembresia("t-1", "m-1", {
      fechaInicio: "2026-02-01",
      fechaFin: "2026-02-10",
      userId: null,
      nombre: null,
    });

    expect(r).toEqual({
      ok: false,
      error: "No se pudo extender la vigencia. Inténtalo de nuevo.",
    });
    expect(from).toHaveBeenCalledTimes(2);
    expect(insert).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "congelacion.extender_vencimiento_fallo",
      expect.objectContaining({ tenantId: "t-1", miembroId: "m-1", error: "boom" })
    );
  });

  it("el update funciona → sí inserta el evento y devuelve ok:true", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-01-01" } }))
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await congelarMembresia("t-1", "m-1", {
      fechaInicio: "2026-02-01",
      fechaFin: "2026-02-10",
      userId: null,
      nombre: null,
    });

    expect(r).toEqual({ ok: true });
    expect(from).toHaveBeenCalledTimes(3);
    expect(logError).not.toHaveBeenCalled();
  });
});

describe("descongelarMembresia: si el revert de fecha_vencimiento falla, no se pierden los días silenciosamente", () => {
  it("falla el update que devuelve los días → logError, pero sigue y cierra la congelación (no bloquea)", async () => {
    const from = vi
      .fn()
      // 1. miembro_eventos.select (congelación activa) — fecha_fin lejana → diasNoConsumidos > 0
      .mockReturnValueOnce(supaResult({ data: { id: "ev-1", fecha_fin: "2099-01-01" } }))
      // 2. miembros.select (fecha_vencimiento)
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2099-01-01" } }))
      // 3. miembros.update (revertir días) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR_VIGENCIA }))
      // 4. miembro_eventos.update (estado: cancelada) → funciona
      .mockReturnValueOnce(supaResult({ error: null }))
      // 5. miembro_eventos.insert (constancia)
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await descongelarMembresia("t-1", "m-1", { userId: null, nombre: null });

    expect(r).toEqual({ ok: true });
    expect(logError).toHaveBeenCalledWith(
      "congelacion.descongelar_revertir_fallo",
      expect.objectContaining({ tenantId: "t-1", miembroId: "m-1", error: "boom" })
    );
    expect(from).toHaveBeenCalledTimes(5);
  });
});

describe("solicitarCongelacionPortal: auto-aprobar pero la extensión falla → queda 'solicitada', no 'activa'", () => {
  it("guarda estado solicitada y aplicada:false cuando extenderVencimiento falla", async () => {
    const insert = vi.fn().mockReturnValue(supaResult({ error: null }));
    const from = vi
      .fn()
      // 1. miembro_eventos.select (solicitud pendiente existente) → ninguna
      .mockReturnValueOnce(supaResult({ data: [] }))
      // 2. gyms.select (congelacion_auto_aprobar) → true
      .mockReturnValueOnce(supaResult({ data: { congelacion_auto_aprobar: true } }))
      // 3. miembros.select (fecha_vencimiento, dentro de extenderVencimiento)
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-01-01" } }))
      // 4. miembros.update (revert) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR_VIGENCIA }))
      // 5. miembro_eventos.insert — capturado para revisar el payload
      .mockReturnValueOnce({ insert });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await solicitarCongelacionPortal(
      "t-1",
      "m-1",
      { fechaInicio: "2026-02-01", fechaFin: "2026-02-10" },
      clienteCon(from)
    );

    expect(r).toEqual({ ok: true, aplicada: false });
    expect(logError).toHaveBeenCalledWith(
      "congelacion.portal_auto_extender_fallo",
      expect.objectContaining({ tenantId: "t-1", miembroId: "m-1" })
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "solicitada" })
    );
  });
});

describe("aprobarCongelacion: si la extensión falla, NO se marca la solicitud como activa", () => {
  it("devuelve ok:false y no llega al update de estado", async () => {
    const from = vi
      .fn()
      // 1. miembro_eventos.select (la solicitud)
      .mockReturnValueOnce(
        supaResult({
          data: {
            miembro_id: "m-1",
            fecha_inicio: "2026-02-01",
            fecha_fin: "2026-02-10",
            estado: "solicitada",
          },
        })
      )
      // 2. miembros.select (dentro de extenderVencimiento)
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-01-01" } }))
      // 3. miembros.update (revert) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR_VIGENCIA }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await aprobarCongelacion("t-1", "ev-1");

    expect(r).toEqual({
      ok: false,
      error: "No se pudo extender la vigencia. Inténtalo de nuevo.",
    });
    expect(from).toHaveBeenCalledTimes(3);
    expect(logError).toHaveBeenCalledWith(
      "congelacion.aprobar_extender_fallo",
      expect.objectContaining({ tenantId: "t-1", eventoId: "ev-1", miembroId: "m-1" })
    );
  });
});
