import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenant: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { getTenant } from "@/lib/tenant";
import { requirePanel } from "./pagina";

function tenant(plan: "basico" | "pro" | "escala", role: "owner" | "gerente" | "receptionist" | "entrenador") {
  vi.mocked(getTenant).mockResolvedValue({ id: "gym-1", slug: "demo", plan, role });
}

describe("requirePanel (gate de páginas con la política de la acción)", () => {
  it("sin permiso → redirect a la casa de la sección, antes de mirar el plan", async () => {
    tenant("basico", "gerente"); // gerente no tiene configurar_planes_promociones (D6)
    await expect(requirePanel("config.tag_crear", { sinPermiso: "/configuracion/gym" })).rejects.toThrow(
      "REDIRECT:/demo/configuracion/gym"
    );
  });

  it("con permiso pero sin plan → { ok: false } con el plan requerido para UpgradePage", async () => {
    tenant("basico", "owner");
    const g = await requirePanel("config.tag_crear", { sinPermiso: "/checkins" });
    expect(g).toMatchObject({ ok: false, code: "SIN_PLAN", feature: "tags", planRequerido: "pro" });
  });

  it("con ambos → ctx con can/has", async () => {
    tenant("pro", "owner");
    const g = await requirePanel("config.tag_crear", { sinPermiso: "/checkins" });
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.ctx.id).toBe("gym-1");
      expect(g.ctx.can("configurar_planes_promociones")).toBe(true);
      expect(g.ctx.has("tags")).toBe(true);
    }
  });
});
