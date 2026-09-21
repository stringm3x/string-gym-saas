/**
 * Bloque 07: enviada_at se escribía al crear la campaña, antes de intentar
 * el envío — una campaña quedaba "enviada" aunque el envío fallara entero o
 * cayera al modo manual sin que el staff terminara. No se puede verificar a
 * mano sin mandar una campaña real de prueba a contactos reales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { createCampana, marcarCampanaEnviada } from "./campanas.queries";

const ERROR = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("createCampana: no se marca enviada al crearla", () => {
  it("el insert no manda enviada_at ni canal", async () => {
    const insert = vi.fn().mockReturnValue(
      supaResult({ data: { id: "c1", nombre: "Promo", enviada_at: null, canal: null }, error: null })
    );
    const from = vi.fn().mockReturnValue({ insert });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await createCampana(
      "t1",
      { nombre: "Promo", mensaje: "Hola {{nombre}}", audiencia: "todos_activos" },
      10,
      "user-1"
    );

    const payload = insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty("enviada_at");
    expect(payload).not.toHaveProperty("canal");
  });
});

describe("marcarCampanaEnviada: confirma enviada_at + canal", () => {
  it("actualiza la fila con el canal correcto", async () => {
    const update = vi.fn().mockReturnValue(supaResult({ error: null }));
    const from = vi.fn().mockReturnValue({ update });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await marcarCampanaEnviada("t1", "c1", "api");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ canal: "api" })
    );
    expect(logError).not.toHaveBeenCalled();
  });

  it("falla el update → logError, no lanza", async () => {
    const update = vi.fn().mockReturnValue(supaResult({ error: ERROR }));
    const from = vi.fn().mockReturnValue({ update });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await marcarCampanaEnviada("t1", "c1", "manual");

    expect(logError).toHaveBeenCalledWith(
      "campanas.marcar_enviada_fallo",
      expect.objectContaining({ tenantId: "t1", campanaId: "c1", canal: "manual" })
    );
  });
});
