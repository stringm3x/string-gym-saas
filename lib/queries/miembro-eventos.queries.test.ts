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
  calcularCambioPlan,
  cambiarPlan,
} from "./miembro-eventos.queries";

const ERROR_VIGENCIA = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("congelarMembresia: no se puede congelar dos veces (bloque 06)", () => {
  it("ya tiene una congelación activa → ok:false, no llega a tocar vigencia", async () => {
    const from = vi
      .fn()
      // 1. miembro_eventos.select (congelación activa existente) → sí hay
      .mockReturnValueOnce(supaResult({ data: { id: "ev-0", fecha_fin: "2099-03-01" } }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await congelarMembresia("t-1", "m-1", {
      fechaInicio: "2099-02-01",
      fechaFin: "2099-02-10",
      userId: null,
      nombre: null,
    });

    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain("ya tiene una congelación activa");
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("congelarMembresia: si extenderVencimiento falla, no se inserta el evento", () => {
  it("falla el update de fecha_vencimiento → ok:false, sin insert, logError", async () => {
    const insert = vi.fn();
    const from = vi
      .fn()
      // 1. miembro_eventos.select (congelación activa existente) → ninguna
      .mockReturnValueOnce(supaResult({ data: null }))
      // 2. miembros.select (fecha_vencimiento actual)
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-01-01" } }))
      // 3. miembros.update (revert) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR_VIGENCIA }))
      // Si el código llegara a insertar el evento, este mock lo revelaría.
      .mockReturnValueOnce({ insert });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await congelarMembresia("t-1", "m-1", {
      fechaInicio: "2099-02-01",
      fechaFin: "2099-02-10",
      userId: null,
      nombre: null,
    });

    expect(r).toEqual({
      ok: false,
      error: "No se pudo extender la vigencia. Inténtalo de nuevo.",
    });
    expect(from).toHaveBeenCalledTimes(3);
    expect(insert).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "congelacion.extender_vencimiento_fallo",
      expect.objectContaining({ tenantId: "t-1", miembroId: "m-1", error: "boom" })
    );
  });

  it("el update funciona → sí inserta el evento y devuelve ok:true", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: null }))
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-01-01" } }))
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await congelarMembresia("t-1", "m-1", {
      fechaInicio: "2099-02-01",
      fechaFin: "2099-02-10",
      userId: null,
      nombre: null,
    });

    expect(r).toEqual({ ok: true });
    expect(from).toHaveBeenCalledTimes(4);
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

describe("solicitarCongelacionPortal: valida vigencia y fechas pasadas antes de tocar nada (bloque 06)", () => {
  it("fechaInicio en el pasado → rechaza sin ninguna consulta", async () => {
    const from = vi.fn();
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await solicitarCongelacionPortal(
      "t-1",
      "m-1",
      { fechaInicio: "2020-01-01", fechaFin: "2020-01-10" },
      clienteCon(from)
    );

    expect(r.ok).toBe(false);
    expect(r.error).toContain("no puede ser anterior a hoy");
    expect(from).not.toHaveBeenCalled();
  });

  it("membresía ya vencida → rechaza, no llega a revisar solicitudes duplicadas", async () => {
    const from = vi
      .fn()
      // 1. miembros.select (fecha_vencimiento) → ya venció
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2020-01-01" } }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await solicitarCongelacionPortal(
      "t-1",
      "m-1",
      { fechaInicio: "2099-02-01", fechaFin: "2099-02-10" },
      clienteCon(from)
    );

    expect(r.ok).toBe(false);
    expect(r.error).toContain("ya venció");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("ya tiene una congelación activa → rechaza antes de mirar auto-aprobar", async () => {
    const from = vi
      .fn()
      // 1. miembros.select (fecha_vencimiento) → vigente
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2099-01-01" } }))
      // 2. miembro_eventos.select (solicitud "solicitada" existente) → ninguna
      .mockReturnValueOnce(supaResult({ data: [] }))
      // 3. miembro_eventos.select (congelación "activa" existente) → sí hay
      .mockReturnValueOnce(supaResult({ data: { id: "ev-0", fecha_fin: "2099-03-01" } }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await solicitarCongelacionPortal(
      "t-1",
      "m-1",
      { fechaInicio: "2099-02-01", fechaFin: "2099-02-10" },
      clienteCon(from)
    );

    expect(r.ok).toBe(false);
    expect(r.error).toContain("Ya tienes una congelación activa");
    expect(from).toHaveBeenCalledTimes(3);
  });
});

describe("solicitarCongelacionPortal: auto-aprobar pero la extensión falla → queda 'solicitada', no 'activa'", () => {
  it("guarda estado solicitada y aplicada:false cuando extenderVencimiento falla", async () => {
    const insert = vi.fn().mockReturnValue(supaResult({ error: null }));
    const from = vi
      .fn()
      // 1. miembros.select (fecha_vencimiento) — vigencia: vigente
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2099-01-01" } }))
      // 2. miembro_eventos.select (solicitud pendiente existente) → ninguna
      .mockReturnValueOnce(supaResult({ data: [] }))
      // 3. miembro_eventos.select (congelación activa existente) → ninguna
      .mockReturnValueOnce(supaResult({ data: null }))
      // 4. gyms.select (congelacion_auto_aprobar) → true
      .mockReturnValueOnce(supaResult({ data: { congelacion_auto_aprobar: true } }))
      // 5. miembros.select (fecha_vencimiento, dentro de extenderVencimiento)
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-01-01" } }))
      // 6. miembros.update (revert) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR_VIGENCIA }))
      // 7. miembro_eventos.insert — capturado para revisar el payload
      .mockReturnValueOnce({ insert });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await solicitarCongelacionPortal(
      "t-1",
      "m-1",
      { fechaInicio: "2099-02-01", fechaFin: "2099-02-10" },
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

describe("calcularCambioPlan: sin prorrateo, la fecha NO se mueve (bloque 09)", () => {
  it("socio sin plan actual → conserva su fecha_vencimiento tal cual (null si nunca tuvo)", async () => {
    const from = vi
      .fn()
      // 1. miembros.select (plan_id null, sin vigencia)
      .mockReturnValueOnce(supaResult({ data: { plan_id: null, fecha_vencimiento: null } }))
      // 2. planes_membresia.select (plan nuevo)
      .mockReturnValueOnce(supaResult({ data: { precio: "500", dias_duracion: 30 } }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await calcularCambioPlan("t-1", "m-1", "plan-nuevo", clienteCon(from));

    expect(r).toEqual({
      ok: true,
      calculo: { tipo: "sin_prorrateo", motivo: "sin_plan_actual", nuevoVencimiento: null },
    });
  });

  it("socio vencido → conserva la fecha vencida tal cual, NO regala un periodo nuevo gratis", async () => {
    const from = vi
      .fn()
      // 1. miembros.select (vencido hace tiempo)
      .mockReturnValueOnce(
        supaResult({ data: { plan_id: "plan-viejo", fecha_vencimiento: "2020-01-01" } })
      )
      // 2. planes_membresia.select (plan nuevo)
      .mockReturnValueOnce(supaResult({ data: { precio: "500", dias_duracion: 30 } }))
      // 3. planes_membresia.select (plan actual, tipo tiempo)
      .mockReturnValueOnce(supaResult({ data: { tipo: "tiempo" } }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await calcularCambioPlan("t-1", "m-1", "plan-nuevo", clienteCon(from));

    expect(r).toEqual({
      ok: true,
      calculo: { tipo: "sin_prorrateo", motivo: "vencido", nuevoVencimiento: "2020-01-01" },
    });
  });

  it("socio con vigencia real pero sin pago vinculado (ej. importado por CSV) → conserva esa fecha, no la pisa", async () => {
    const from = vi
      .fn()
      // 1. miembros.select (vigente a futuro, importado)
      .mockReturnValueOnce(
        supaResult({ data: { plan_id: "plan-viejo", fecha_vencimiento: "2099-06-01" } })
      )
      // 2. planes_membresia.select (plan nuevo)
      .mockReturnValueOnce(supaResult({ data: { precio: "500", dias_duracion: 30 } }))
      // 3. planes_membresia.select (plan actual, tipo tiempo)
      .mockReturnValueOnce(supaResult({ data: { tipo: "tiempo" } }))
      // 4. pagos.select (pago vigente) → ninguno
      .mockReturnValueOnce(supaResult({ data: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await calcularCambioPlan("t-1", "m-1", "plan-nuevo", clienteCon(from));

    expect(r).toEqual({
      ok: true,
      calculo: { tipo: "sin_prorrateo", motivo: "sin_pago_vigente", nuevoVencimiento: "2099-06-01" },
    });
  });
});

describe("cambiarPlan: escribe la fecha conservada sin prorrateo (bloque 09)", () => {
  it("sin prorrateo → el UPDATE manda la MISMA fecha_vencimiento que ya tenía, no una recalculada", async () => {
    const update = vi.fn().mockReturnValue(supaResult({ error: null }));
    const from = vi
      .fn()
      // calcularCambioPlan: 1. miembros.select
      .mockReturnValueOnce(
        supaResult({ data: { plan_id: "plan-viejo", fecha_vencimiento: "2099-06-01" } })
      )
      // 2. planes_membresia.select (plan nuevo)
      .mockReturnValueOnce(supaResult({ data: { precio: "500", dias_duracion: 30 } }))
      // 3. planes_membresia.select (plan actual, tipo)
      .mockReturnValueOnce(supaResult({ data: { tipo: "tiempo" } }))
      // 4. pagos.select (pago vigente) → ninguno → sin_pago_vigente
      .mockReturnValueOnce(supaResult({ data: null }))
      // cambiarPlan: 5. miembros.select (plan_id actual, para el evento)
      .mockReturnValueOnce(supaResult({ data: { plan_id: "plan-viejo" } }))
      // 6. planes_membresia.select (nombre/tipo/visitas del plan nuevo)
      .mockReturnValueOnce(
        supaResult({ data: { nombre: "Trimestral", tipo: "tiempo", visitas: null } })
      )
      // 7. planes_membresia.select (nombre del plan anterior)
      .mockReturnValueOnce(supaResult({ data: { nombre: "Mensual" } }))
      // 8. miembros.update — capturado para revisar el payload
      .mockReturnValueOnce({ update })
      // 9. miembro_eventos.insert
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await cambiarPlan("t-1", "m-1", "plan-nuevo", { userId: null, nombre: null });

    expect(r).toEqual({ ok: true, nuevoVencimiento: "2099-06-01", notaCredito: 0 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: "plan-nuevo",
        fecha_vencimiento: "2099-06-01",
      })
    );
  });
});
