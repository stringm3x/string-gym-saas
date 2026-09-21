/**
 * Bloque 05: las dos escrituras de anularPago que antes no revisaban
 * `error` — la reversión de vigencia y la reapertura del plan de pago. No
 * se pueden probar a mano sin anular un pago real y romper el update a
 * propósito, así que el test es la verificación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/features", () => ({ hasFeature: vi.fn() }));
vi.mock("@/lib/email/send-recibo", () => ({ sendRecibo: vi.fn() }));
vi.mock("@/lib/whatsapp/emit", () => ({ emitPagoRegistrado: vi.fn() }));
vi.mock("@/lib/utils/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/queries/cajas.queries", () => ({
  getCajaDefault: vi.fn(),
  resolverCajaDeVenta: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { anularPago } from "./pagos.queries";

const ERROR = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>, rpc: ReturnType<typeof vi.fn>) {
  return { from, rpc } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("anularPago: revertir la vigencia", () => {
  it("el update de fecha_vencimiento falla → logError, pero el pago sigue anulado (ok:true)", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const from = vi
      .fn()
      // 1. pagos.select
      .mockReturnValueOnce(
        supaResult({
          data: {
            miembro_id: "m-1",
            concepto: "membresia",
            periodo_inicio: "2026-01-01",
            periodo_fin: "2026-02-01",
          },
        })
      )
      // 2. miembros.select — fecha_vencimiento === periodo_fin del pago → dispara el revert
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-02-01" } }))
      // 3. miembros.update (revert) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }))
      // 4. cuotas_pago.select — ninguna cuota ligada a este pago
      .mockReturnValueOnce(supaResult({ data: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from, rpc));

    const r = await anularPago("t-1", "pago-1");

    expect(r).toEqual({ ok: true });
    expect(logError).toHaveBeenCalledWith(
      "pago.anular_revertir_vigencia_fallo",
      expect.objectContaining({ tenantId: "t-1", pagoId: "pago-1", miembroId: "m-1" })
    );
  });

  it("nadie renovó después Y el update funciona → sin logError", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(
        supaResult({
          data: {
            miembro_id: "m-1",
            concepto: "membresia",
            periodo_inicio: "2026-01-01",
            periodo_fin: "2026-02-01",
          },
        })
      )
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: "2026-02-01" } }))
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ data: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from, rpc));

    const r = await anularPago("t-1", "pago-1");

    expect(r).toEqual({ ok: true });
    expect(logError).not.toHaveBeenCalled();
  });
});

describe("anularPago: reabrir el plan de pago cuando estaba completado", () => {
  it("el update a 'activo' falla → logError, pero sigue devolviendo ok:true (el pago sí se anuló)", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const from = vi
      .fn()
      // 1. pagos.select — concepto distinto de membresía, no dispara el bloque de vigencia
      .mockReturnValueOnce(
        supaResult({
          data: { miembro_id: "m-1", concepto: "producto", periodo_inicio: null, periodo_fin: null },
        })
      )
      // 2. cuotas_pago.select — sí hay una cuota ligada
      .mockReturnValueOnce(supaResult({ data: { id: "cuota-1", plan_id: "plan-1" } }))
      // 3. cuotas_pago.update (desmarcar pagada) → funciona
      .mockReturnValueOnce(supaResult({ error: null }))
      // 4. planes_pago.update (reabrir) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from, rpc));

    const r = await anularPago("t-1", "pago-1");

    expect(r).toEqual({ ok: true });
    expect(logError).toHaveBeenCalledWith(
      "pago.anular_reabrir_plan_pago_fallo",
      expect.objectContaining({ tenantId: "t-1", pagoId: "pago-1", planPagoId: "plan-1" })
    );
  });
});
