/**
 * El hallazgo que originó el barrido del bloque 05: `.then(() => {}, () =>
 * {})` solo atrapa una promesa RECHAZADA (fallo de red); Supabase-js
 * resuelve con `{ error }` incluso cuando la escritura falla, así que el
 * insert de log podía fallar entero sin que el `then` de "éxito" lo notara.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import { logApiRequest } from "./log";

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("logApiRequest", () => {
  it("Supabase resuelve con { error } (no rechaza) → antes se perdía, ahora logError", async () => {
    const insert = vi.fn().mockReturnValue(supaResult({ error: { message: "boom" } }));
    vi.mocked(createAdminClient).mockReturnValue({ from: () => ({ insert }) } as never);

    logApiRequest({
      tenantId: "t-1",
      endpoint: "/planes",
      method: "GET",
      statusCode: 200,
      ip: "1.2.3.4",
    });
    // Fire-and-forget: esperar un tick a que el .then() interno corra.
    await new Promise((r) => setTimeout(r, 0));

    expect(logError).toHaveBeenCalledWith(
      "api.log_request_fallo",
      expect.objectContaining({ tenantId: "t-1", endpoint: "/planes", error: "boom" })
    );
  });

  it("una promesa rechazada de verdad (fallo de red) también se loguea", async () => {
    const insert = vi.fn().mockReturnValue(Promise.reject(new Error("network down")));
    vi.mocked(createAdminClient).mockReturnValue({ from: () => ({ insert }) } as never);

    logApiRequest({
      tenantId: "t-1",
      endpoint: "/planes",
      method: "GET",
      statusCode: 200,
      ip: null,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(logError).toHaveBeenCalledWith(
      "api.log_request_fallo",
      expect.objectContaining({ tenantId: "t-1", error: "network down" })
    );
  });

  it("insert exitoso → sin logError", async () => {
    const insert = vi.fn().mockReturnValue(supaResult({ error: null }));
    vi.mocked(createAdminClient).mockReturnValue({ from: () => ({ insert }) } as never);

    logApiRequest({
      tenantId: "t-1",
      endpoint: "/planes",
      method: "GET",
      statusCode: 200,
      ip: null,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(logError).not.toHaveBeenCalled();
  });
});
