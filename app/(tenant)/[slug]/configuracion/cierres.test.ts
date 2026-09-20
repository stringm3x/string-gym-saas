/**
 * Cierres de feature del PR 6 (configuracion/), probados contra las
 * acciones reales con el plan mockeado. Ningún tenant vivo ha ejercido
 * ninguna de estas features (docs/autorizacion-acciones.md §8), así que el
 * cierre se verifica aquí: basico → SIN_PLAN con el mensaje correcto y sin
 * tocar la query; pro → la acción sigue su curso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getTenant: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/queries/opiniones.queries", () => ({ updateGooglePlaceId: vi.fn() }));
vi.mock("@/lib/queries/marca.queries", () => ({ updateGymMarca: vi.fn(), updateGymLogo: vi.fn() }));
vi.mock("@/lib/queries/plantillas.queries", () => ({
  createPlantilla: vi.fn(),
  updatePlantilla: vi.fn(),
  deletePlantilla: vi.fn(),
  toggleActivoPlantilla: vi.fn(),
  seedPlantillas: vi.fn(),
}));
vi.mock("@/lib/queries/promociones.queries", () => ({
  createPromocion: vi.fn(),
  updatePromocion: vi.fn(),
  togglePromocionActiva: vi.fn(),
}));
vi.mock("@/lib/queries/tags.queries", () => ({
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));
vi.mock("@/lib/queries/staff.queries", () => ({
  getStaffById: vi.fn(),
  setStaffPin: vi.fn(),
  clearStaffPin: vi.fn(),
}));

import { getTenant } from "@/lib/tenant";
import { updateGooglePlaceId } from "@/lib/queries/opiniones.queries";
import { seedPlantillas } from "@/lib/queries/plantillas.queries";
import { togglePromocionActiva } from "@/lib/queries/promociones.queries";
import { deleteTag } from "@/lib/queries/tags.queries";
import { getStaffById } from "@/lib/queries/staff.queries";
import { guardarGooglePlaceIdAction } from "./marca/actions";
import { createPlantillaAction, seedPlantillasAction } from "./plantillas/actions";
import { togglePromocionAction } from "./promociones/actions";
import { deleteTagAction } from "./tags/actions";
import { deactivateStaffAction, inviteStaffAction } from "./staff/actions";

type Plan = "basico" | "pro" | "escala";
type Rol = "owner" | "gerente" | "receptionist" | "entrenador";

vi.spyOn(console, "warn").mockImplementation(() => {});

function tenant(plan: Plan, role: Rol = "owner") {
  vi.mocked(getTenant).mockResolvedValue({ id: "gym-1", slug: "demo", plan, role });
}

const REQUIERE_PRO = "Esta función requiere el plan Pro.";
const SIN_PLAN = { ok: false, error: REQUIERE_PRO, code: "SIN_PLAN" };
const FORM_VACIO = { ok: false, error: null, fieldErrors: {} };

beforeEach(() => {
  vi.mocked(updateGooglePlaceId).mockReset();
  vi.mocked(seedPlantillas).mockReset();
  vi.mocked(togglePromocionActiva).mockReset();
  vi.mocked(deleteTag).mockReset();
  vi.mocked(getStaffById).mockReset();
});

describe("cierre: opiniones (guardarGooglePlaceIdAction)", () => {
  it("basico → SIN_PLAN sin tocar la query; pro → pasa", async () => {
    tenant("basico");
    expect(await guardarGooglePlaceIdAction("ChIJ…")).toEqual(SIN_PLAN);
    expect(updateGooglePlaceId).not.toHaveBeenCalled();

    tenant("pro", "gerente");
    vi.mocked(updateGooglePlaceId).mockResolvedValue({ ok: true });
    expect(await guardarGooglePlaceIdAction("ChIJ…")).toEqual({ ok: true });
  });
});

describe("cierre: plantillas_mensaje", () => {
  it("seed: basico → SIN_PLAN; pro → pasa", async () => {
    tenant("basico");
    expect(await seedPlantillasAction()).toEqual(SIN_PLAN);
    expect(seedPlantillas).not.toHaveBeenCalled();

    tenant("pro");
    vi.mocked(seedPlantillas).mockResolvedValue({ ok: true, count: 5 });
    expect(await seedPlantillasAction()).toEqual({ ok: true, count: 5 });
  });

  it("crear (form): basico → mensaje de plan con fieldErrors vacío; pro → llega al parse", async () => {
    tenant("basico");
    expect(await createPlantillaAction(FORM_VACIO, new FormData())).toEqual({
      ok: false,
      error: REQUIERE_PRO,
      fieldErrors: {},
    });
    tenant("pro");
    const r = await createPlantillaAction(FORM_VACIO, new FormData());
    expect(r.error).toBe("Revisa los campos marcados.");
  });

  it("gerente no tiene configurar_planes_promociones (D6) → SIN_PERMISO aunque sea pro", async () => {
    tenant("pro", "gerente");
    expect(await seedPlantillasAction()).toMatchObject({ ok: false, code: "SIN_PERMISO" });
  });
});

describe("cierre: promociones (togglePromocionAction)", () => {
  it("basico → SIN_PLAN; pro → pasa a la query", async () => {
    tenant("basico");
    expect(await togglePromocionAction("p-1", false)).toEqual(SIN_PLAN);
    expect(togglePromocionActiva).not.toHaveBeenCalled();

    tenant("pro");
    vi.mocked(togglePromocionActiva).mockResolvedValue({ ok: true });
    expect(await togglePromocionAction("p-1", false)).toEqual({ ok: true });
  });
});

describe("cierre: tags (deleteTagAction)", () => {
  it("basico → SIN_PLAN; pro → pasa a la query", async () => {
    tenant("basico");
    expect(await deleteTagAction("t-1")).toEqual(SIN_PLAN);
    expect(deleteTag).not.toHaveBeenCalled();

    tenant("pro");
    vi.mocked(deleteTag).mockResolvedValue({ ok: true });
    expect(await deleteTagAction("t-1")).toEqual({ ok: true });
  });
});

describe("cierre: multiusuario (gestión del equipo existente)", () => {
  it("desactivar: basico → SIN_PLAN sin consultar staff; pro + gerente → llega al cuerpo", async () => {
    tenant("basico");
    expect(await deactivateStaffAction("s-1")).toEqual(SIN_PLAN);
    expect(getStaffById).not.toHaveBeenCalled();

    tenant("pro", "gerente");
    vi.mocked(getStaffById).mockResolvedValue(null);
    expect(await deactivateStaffAction("s-1")).toEqual({ ok: false, error: "No encontrado." });
  });

  it("invitar conserva su mensaje propio para Starter", async () => {
    tenant("basico");
    expect(await inviteStaffAction(FORM_VACIO, new FormData())).toEqual({
      ok: false,
      error: "Invitar a tu equipo está disponible en Plan Pro.",
      fieldErrors: {},
    });
  });

  it("recepcionista no gestiona staff → SIN_PERMISO", async () => {
    tenant("escala", "receptionist");
    expect(await deactivateStaffAction("s-1")).toMatchObject({ ok: false, code: "SIN_PERMISO" });
  });
});
