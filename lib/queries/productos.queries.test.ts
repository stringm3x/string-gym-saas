/**
 * Bloque 07: la alerta de stock bajo antes solo saltaba si stock_minimo > 0
 * — y esa columna nace en 0, así que casi ningún producto alertaba nunca
 * aunque llegara a cero. Difícil de verificar a mano sin vaciar stock real.
 */
import { describe, it, expect, vi } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { countStockBajo } from "./productos.queries";

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

describe("countStockBajo: sin stock siempre alerta, tenga o no stock_minimo", () => {
  it("stock_actual 0 y stock_minimo 0 (default) → cuenta como bajo", async () => {
    const from = vi.fn().mockReturnValueOnce(
      supaResult({
        data: [{ stock_actual: 0, stock_minimo: 0 }],
        error: null,
      })
    );
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    expect(await countStockBajo("t1")).toBe(1);
  });

  it("stock_minimo configurado y stock_actual lo cruza → cuenta", async () => {
    const from = vi.fn().mockReturnValueOnce(
      supaResult({
        data: [{ stock_actual: 3, stock_minimo: 5 }],
        error: null,
      })
    );
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    expect(await countStockBajo("t1")).toBe(1);
  });

  it("stock por encima del mínimo y mayor a 0 → no cuenta", async () => {
    const from = vi.fn().mockReturnValueOnce(
      supaResult({
        data: [{ stock_actual: 10, stock_minimo: 5 }],
        error: null,
      })
    );
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    expect(await countStockBajo("t1")).toBe(0);
  });
});
