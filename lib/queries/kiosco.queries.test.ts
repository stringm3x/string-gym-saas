/**
 * Bloque 05: si autorizarCodigo falla al cobrar Y falla al revertir el
 * claim (usado=false), el código queda atascado en "usado" para siempre.
 * Antes el staff veía el error del pago como si reintentar con el mismo
 * código fuera a funcionar. No se puede probar a mano sin dejar un código
 * real atascado en producción, así que el test es la verificación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
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
import { autorizarCodigo } from "./kiosco.queries";

const ERROR = { message: "boom" };
const EXPIRA_FUTURO = new Date(Date.now() + 5 * 60_000).toISOString();

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

const CODIGO_COMPRA = {
  id: "cod-1",
  tipo: "compra",
  usado: false,
  expira_at: EXPIRA_FUTURO,
  miembro_id: "m-1",
  payload: {
    metodo: "efectivo",
    total: 100,
    items: [{ producto_id: "p-1", nombre: "Agua", cantidad: 1, precio: 100 }],
  },
};

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("autorizarCodigo: revertir el claim cuando el pago falla", () => {
  it("el pago falla Y el revert también falla → el mensaje dice que el código quedó atascado, no repite el error del pago", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: false, error: "Sin stock." });
    const from = vi
      .fn()
      // 1. codigos_autorizacion.select
      .mockReturnValueOnce(supaResult({ data: CODIGO_COMPRA }))
      // 2. productos.select (stock) — suficiente
      .mockReturnValueOnce(
        supaResult({ data: [{ id: "p-1", nombre: "Agua", inventario: { stock_actual: 5 } }] })
      )
      // 3. codigos_autorizacion.update (claim) → gana la carrera
      .mockReturnValueOnce(supaResult({ data: { id: "cod-1" } }))
      // 4. codigos_autorizacion.update (revertir usado=false) → FALLA
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await autorizarCodigo("t-1", "cod-1");

    expect(r).toEqual({
      ok: false,
      error:
        "No se pudo procesar el pago ni liberar este código. Pídele al socio que genere uno nuevo desde el kiosco.",
    });
    expect(logError).toHaveBeenCalledWith(
      "kiosco.revertir_codigo_fallo",
      expect.objectContaining({ tenantId: "t-1", codigoId: "cod-1" })
    );
  });

  it("el pago falla pero el revert SÍ funciona → muestra el error real del pago (el código puede reintentarse)", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: false, error: "Sin stock." });
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: CODIGO_COMPRA }))
      .mockReturnValueOnce(
        supaResult({ data: [{ id: "p-1", nombre: "Agua", inventario: { stock_actual: 5 } }] })
      )
      .mockReturnValueOnce(supaResult({ data: { id: "cod-1" } }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await autorizarCodigo("t-1", "cod-1");

    expect(r).toEqual({ ok: false, error: "Sin stock." });
    expect(logError).not.toHaveBeenCalled();
  });
});
