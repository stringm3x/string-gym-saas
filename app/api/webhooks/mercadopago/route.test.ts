/**
 * Bloque 05: revertirPagoMp tiene tres escrituras (pagos_externos, pagos,
 * miembros) que antes no revisaban `error` — un reembolso o contracargo de
 * MercadoPago real. No se puede simular a mano sin un reembolso de verdad
 * en el sandbox de MP y sin romper un update a propósito, así que el test
 * mockeando el admin client es la única verificación honesta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/utils/notifications", () => ({ createNotification: vi.fn() }));

import { logError } from "@/lib/log";
import { createNotification } from "@/lib/utils/notifications";
import { revertirPagoMp } from "./route";

const ERROR = { message: "boom" };

function adminCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
  vi.mocked(createNotification).mockReset().mockResolvedValue(undefined);
});

describe("revertirPagoMp", () => {
  it("falla marcar pagos_externos.status → logError, pero sigue revirtiendo el pago real", async () => {
    const from = vi
      .fn()
      // 1. pagos_externos.update(status) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }))
      // 2. pagos.select
      .mockReturnValueOnce(
        supaResult({
          data: {
            id: "pago-1",
            miembro_id: "m-1",
            periodo_inicio: "2026-01-01",
            monto: 500,
            reembolsado_at: null,
          },
        })
      )
      // 3. pagos.update(reembolsado_at) → funciona
      .mockReturnValueOnce(supaResult({ error: null }))
      // 4. miembros.update(fecha_vencimiento) → funciona
      .mockReturnValueOnce(supaResult({ error: null }));

    await revertirPagoMp(
      adminCon(from),
      "t-1",
      { id: "ext-1", pago_id: "pago-1" },
      "refunded"
    );

    expect(logError).toHaveBeenCalledWith(
      "mp_webhook.revertir_status_externo_fallo",
      expect.objectContaining({ tenantId: "t-1", pagosExternosId: "ext-1" })
    );
    // No se detiene por eso: sigue hasta la notificación.
    expect(createNotification).toHaveBeenCalledOnce();
  });

  it("falla marcar pagos.reembolsado_at → logError — dinero que seguiría contando como ingreso", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(
        supaResult({
          data: {
            id: "pago-1",
            miembro_id: "m-1",
            periodo_inicio: "2026-01-01",
            monto: 500,
            reembolsado_at: null,
          },
        })
      )
      // pagos.update → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }))
      .mockReturnValueOnce(supaResult({ error: null }));

    await revertirPagoMp(
      adminCon(from),
      "t-1",
      { id: "ext-1", pago_id: "pago-1" },
      "refunded"
    );

    expect(logError).toHaveBeenCalledWith(
      "mp_webhook.marcar_pago_reembolsado_fallo",
      expect.objectContaining({ tenantId: "t-1", pagoId: "pago-1" })
    );
  });

  it("falla revertir la vigencia del miembro → logError", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(
        supaResult({
          data: {
            id: "pago-1",
            miembro_id: "m-1",
            periodo_inicio: "2026-01-01",
            monto: 500,
            reembolsado_at: null,
          },
        })
      )
      .mockReturnValueOnce(supaResult({ error: null }))
      // miembros.update → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));

    await revertirPagoMp(
      adminCon(from),
      "t-1",
      { id: "ext-1", pago_id: "pago-1" },
      "charged_back"
    );

    expect(logError).toHaveBeenCalledWith(
      "mp_webhook.revertir_vigencia_fallo",
      expect.objectContaining({ tenantId: "t-1", pagoId: "pago-1", miembroId: "m-1" })
    );
  });

  it("las tres escrituras funcionan → ningún logError", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(
        supaResult({
          data: {
            id: "pago-1",
            miembro_id: "m-1",
            periodo_inicio: "2026-01-01",
            monto: 500,
            reembolsado_at: null,
          },
        })
      )
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ error: null }));

    await revertirPagoMp(
      adminCon(from),
      "t-1",
      { id: "ext-1", pago_id: "pago-1" },
      "refunded"
    );

    expect(logError).not.toHaveBeenCalled();
  });

  it("ya estaba reembolsado (idempotente) → no vuelve a tocar pagos ni miembros", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(
        supaResult({
          data: {
            id: "pago-1",
            miembro_id: "m-1",
            periodo_inicio: "2026-01-01",
            monto: 500,
            reembolsado_at: "2026-01-05T00:00:00.000Z",
          },
        })
      );

    await revertirPagoMp(
      adminCon(from),
      "t-1",
      { id: "ext-1", pago_id: "pago-1" },
      "refunded"
    );

    expect(from).toHaveBeenCalledTimes(2);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
