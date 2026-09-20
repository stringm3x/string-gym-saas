import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey } from "./auth";
import type { NextRequest } from "next/server";

function request(key: string | null): NextRequest {
  return {
    headers: { get: (n: string) => (n === "authorization" && key ? `Bearer ${key}` : null) },
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

function keyEnGym(gym: { slug: string; plan: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: gym ? { tenant_id: "gym-1", gyms: gym } : null,
  });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({ select }),
    rpc: vi.fn().mockResolvedValue({}),
  } as never);
}

describe("authenticateApiKey: feature api por plan", () => {
  it("key válida de un gym Starter → 403 FORBIDDEN (el plan no incluye la API)", async () => {
    keyEnGym({ slug: "demo", plan: "basico" });
    const r = await authenticateApiKey(request("sgk_x"), "demo");
    expect(r).toEqual({
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "El plan de este gym no incluye la API.",
    });
  });

  it("key válida de un gym Pro → ok con el plan en el contexto", async () => {
    keyEnGym({ slug: "demo", plan: "pro" });
    const r = await authenticateApiKey(request("sgk_x"), "demo");
    expect(r).toEqual({
      ok: true,
      ctx: { tenantId: "gym-1", gymSlug: "demo", plan: "pro", apiKey: "sgk_x" },
    });
  });

  it("slug ajeno sigue siendo 403 antes de mirar el plan", async () => {
    keyEnGym({ slug: "otro", plan: "escala" });
    const r = await authenticateApiKey(request("sgk_x"), "demo");
    expect(r).toMatchObject({ ok: false, status: 403, message: "La API key no corresponde a este gym." });
  });

  it("sin key → 401", async () => {
    keyEnGym({ slug: "demo", plan: "pro" });
    expect(await authenticateApiKey(request(null), "demo")).toMatchObject({ ok: false, status: 401 });
  });
});
