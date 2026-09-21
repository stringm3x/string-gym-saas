/**
 * Bloque 05: dos cosas de créditos que no se pueden probar a mano sin
 * romper datos reales — (1) marcar un plan como "completado" cuando la
 * última cuota se cobra, y (2) el rollback de `planes_pago` cuando falla
 * un paso posterior a crearlo. Créditos ya arrastra tres bugs conocidos
 * (cuota 1 sin cobrar, pagarCuota no atómico, reembolso sin desmarcar
 * cuota); estos tests existen para no sumarle un cuarto en silencio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/queries/productos.queries", () => ({ aplicarMovimiento: vi.fn() }));
vi.mock("@/lib/queries/pagos.queries", () => ({ createPago: vi.fn() }));
vi.mock("@/lib/utils/membresia-rango", () => ({
  calcularRangoPorDias: vi.fn(() => ({
    periodo_inicio: "2026-01-01",
    periodo_fin: "2026-02-01",
  })),
}));

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { createPago } from "@/lib/queries/pagos.queries";
import { createPlanPago, createAbonoMembresia, pagarCuota } from "./creditos.queries";

const ERROR = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("pagarCuota: marcar el plan como completado", () => {
  it("era la última cuota pero el update a 'completado' falla → logError, sigue ok:true", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: true, id: "pago-1", token: "tok" });
    const from = vi
      .fn()
      // 1. cuotas_pago.select (la cuota)
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1", monto: 500, pagado_at: null } })
      )
      // 2. planes_pago.select (el plan)
      .mockReturnValueOnce(
        supaResult({
          data: { id: "plan-1", miembro_id: "m-1", plan_membresia_id: null, producto_id: null },
        })
      )
      // 3. cuotas_pago.select count (pagadas previas) → 1, no es el primer pago
      .mockReturnValueOnce(supaResult({ count: 1 }))
      // 4. cuotas_pago.update (marcar pagada) → funciona
      .mockReturnValueOnce(supaResult({ error: null }))
      // 5. cuotas_pago.select count (pendientes) → 0, era la última
      .mockReturnValueOnce(supaResult({ count: 0 }))
      // 6. planes_pago.update (estado: completado) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await pagarCuota("t-1", "cuota-1", "efectivo");

    expect(r).toEqual({
      ok: true,
      pagoId: "pago-1",
      planCompletado: true,
      reciboError: undefined,
    });
    expect(logError).toHaveBeenCalledWith(
      "credito.marcar_plan_completado_fallo",
      expect.objectContaining({ tenantId: "t-1", planPagoId: "plan-1" })
    );
  });

  it("el update funciona → sin logError", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: true, id: "pago-1", token: "tok" });
    const from = vi
      .fn()
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1", monto: 500, pagado_at: null } })
      )
      .mockReturnValueOnce(
        supaResult({
          data: { id: "plan-1", miembro_id: "m-1", plan_membresia_id: null, producto_id: null },
        })
      )
      .mockReturnValueOnce(supaResult({ count: 1 }))
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ count: 0 }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await pagarCuota("t-1", "cuota-1", "efectivo");

    expect(r.ok).toBe(true);
    expect(logError).not.toHaveBeenCalled();
  });
});

describe("createPlanPago: rollback si fallan las cuotas", () => {
  it("insertar las cuotas falla Y el delete de limpieza también falla → logError, plan huérfano visible en logs", async () => {
    const from = vi
      .fn()
      // 1. planes_pago.insert
      .mockReturnValueOnce(supaResult({ data: { id: "plan-1" }, error: null }))
      // 2. cuotas_pago.insert → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }))
      // 3. planes_pago.delete (rollback) → TAMBIÉN falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createPlanPago("t-1", {
      miembro_id: "m-1",
      tipo: "membresia",
      plan_membresia_id: "pm-1",
      total: 1000,
      cuotas: 4,
      frecuencia: "quincenal",
    });

    expect(r).toEqual({ ok: false, error: "boom" });
    expect(logError).toHaveBeenCalledWith(
      "credito.rollback_plan_huerfano",
      expect.objectContaining({
        tenantId: "t-1",
        planId: "plan-1",
        motivo: "cuotas_insert_fallo",
      })
    );
  });

  it("insertar las cuotas falla pero el delete de limpieza SÍ funciona → sin logError", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: { id: "plan-1" }, error: null }))
      .mockReturnValueOnce(supaResult({ error: ERROR }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createPlanPago("t-1", {
      miembro_id: "m-1",
      tipo: "membresia",
      plan_membresia_id: "pm-1",
      total: 1000,
      cuotas: 4,
      frecuencia: "quincenal",
    });

    expect(r).toEqual({ ok: false, error: "boom" });
    expect(logError).not.toHaveBeenCalled();
  });
});

describe("createAbonoMembresia: mismo rollback, mismo helper", () => {
  it("insertar las cuotas del abono falla Y el rollback también falla → logError", async () => {
    const from = vi
      .fn()
      // 1. planes_membresia.select
      .mockReturnValueOnce(
        supaResult({ data: { id: "pm-1", nombre: "Mensual", precio: "1000", dias_duracion: 30 } })
      )
      // 2. miembros.select
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: null } }))
      // 3. planes_pago.insert
      .mockReturnValueOnce(supaResult({ data: { id: "plan-1" }, error: null }))
      // 4. cuotas_pago.insert → falla
      .mockReturnValueOnce(supaResult({ error: ERROR, data: null }))
      // 5. planes_pago.delete (rollback) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createAbonoMembresia("t-1", {
      miembroId: "m-1",
      planMembresiaId: "pm-1",
      montoPagado: 300,
      metodoPago: "efectivo",
    });

    expect(r).toEqual({ ok: false, error: "boom" });
    expect(logError).toHaveBeenCalledWith(
      "credito.rollback_plan_huerfano",
      expect.objectContaining({
        tenantId: "t-1",
        planId: "plan-1",
        motivo: "cuotas_insert_fallo",
      })
    );
  });
});
