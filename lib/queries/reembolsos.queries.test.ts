/**
 * Bloque 08: reembolsar un pago que saldaba una cuota de un plan a plazos
 * dejaba la cuota marcada "pagada" para siempre, así que Cuentas por Cobrar
 * mentía (mostraba saldada una deuda cuyo dinero ya se devolvió). No se
 * puede verificar a mano sin reembolsar un pago real de un plan real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/queries/productos.queries", () => ({ aplicarMovimiento: vi.fn() }));
vi.mock("@/lib/queries/notas-credito.queries", () => ({ crearNotaCredito: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { crearReembolso } from "./reembolsos.queries";

const ERROR = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

const PAGO_MEMBRESIA = {
  id: "pago-1",
  monto: 500,
  concepto: "membresia",
  producto_id: null,
  miembro_id: "m-1",
  anulado_at: null,
  reembolsado_at: null,
};

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("crearReembolso: pago sin cuota vinculada", () => {
  it("no toca cuotas_pago si el pago no saldaba ninguna cuota", async () => {
    const from = vi
      .fn()
      // 1. pagos.select
      .mockReturnValueOnce(supaResult({ data: PAGO_MEMBRESIA }))
      // 2. reembolsos.insert
      .mockReturnValueOnce(supaResult({ data: { id: "reemb-1" }, error: null }))
      // 3. pagos.update (reembolsado_at)
      .mockReturnValueOnce(supaResult({ error: null }))
      // 4. cuotas_pago.select (¿hay una cuota con este pago_id?) → ninguna
      .mockReturnValueOnce(supaResult({ data: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await crearReembolso("t-1", {
      pagoId: "pago-1",
      motivo: "prueba",
      tipo: "efectivo",
      userId: null,
      nombre: null,
    });

    expect(r).toEqual({ ok: true, id: "reemb-1" });
    expect(from).toHaveBeenCalledTimes(4);
  });
});

describe("crearReembolso: pago que saldaba una cuota (bloque 08)", () => {
  it("desmarca la cuota y reabre el plan si estaba completado", async () => {
    const cuotaUpdate = vi.fn().mockReturnValue(supaResult({ error: null }));
    const planUpdate = vi.fn().mockReturnValue(supaResult({ error: null }));
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: PAGO_MEMBRESIA }))
      .mockReturnValueOnce(supaResult({ data: { id: "reemb-1" }, error: null }))
      .mockReturnValueOnce(supaResult({ error: null }))
      // 4. cuotas_pago.select → sí hay una cuota ligada a este pago
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1" } })
      )
      // 5. cuotas_pago.update (desmarcar) — capturado
      .mockReturnValueOnce({ update: cuotaUpdate })
      // 6. planes_pago.update (reabrir si estaba completado) — capturado
      .mockReturnValueOnce({ update: planUpdate });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await crearReembolso("t-1", {
      pagoId: "pago-1",
      motivo: "prueba",
      tipo: "efectivo",
      userId: null,
      nombre: null,
    });

    expect(r).toEqual({ ok: true, id: "reemb-1" });
    expect(cuotaUpdate).toHaveBeenCalledWith({ pagado_at: null, pago_id: null });
    expect(planUpdate).toHaveBeenCalledWith({ estado: "activo" });
  });

  it("falla al desmarcar la cuota → logError, el reembolso NO se bloquea (el dinero ya se devolvió)", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: PAGO_MEMBRESIA }))
      .mockReturnValueOnce(supaResult({ data: { id: "reemb-1" }, error: null }))
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1" } })
      )
      // 5. cuotas_pago.update → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await crearReembolso("t-1", {
      pagoId: "pago-1",
      motivo: "prueba",
      tipo: "efectivo",
      userId: null,
      nombre: null,
    });

    expect(r).toEqual({ ok: true, id: "reemb-1" });
    expect(logError).toHaveBeenCalledWith(
      "credito.reembolso_desmarcar_cuota_fallo",
      expect.objectContaining({ tenantId: "t-1", pagoId: "pago-1", cuotaId: "cuota-1" })
    );
    // No debe intentar reabrir el plan si ni siquiera se pudo desmarcar la cuota.
    expect(from).toHaveBeenCalledTimes(5);
  });
});
