/**
 * Cierres de feature del PR 5 (miembros/), probados contra las acciones
 * reales con el plan mockeado: `tags` y `bulk_actions` (ambas Pro) tienen
 * uso cero en todo el histórico de los tenants vivos
 * (sql/reportes/uso-features-pr5-miembros.sql), así que nadie ha ejercido
 * el cierre. También se verifica que crear/editar un socio SIN etiquetas
 * sigue abierto en Starter (es caja/miembros básica), y el cambio de rol
 * de importar (owner → configurar_general).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getTenant: vi.fn() }));
vi.mock("@/lib/queries/miembros.queries", () => ({
  createMiembro: vi.fn(),
  updateMiembro: vi.fn(),
  updateMiembroNotas: vi.fn(),
  archivarMiembro: vi.fn(),
  restaurarMiembro: vi.fn(),
  findMiembroDuplicado: vi.fn(),
  bulkCreateMiembros: vi.fn(),
  getExistingContactos: vi.fn(),
}));
vi.mock("@/lib/queries/pagos.queries", () => ({ createPago: vi.fn() }));
vi.mock("@/lib/queries/prospectos.queries", () => ({ updateEstadoProspecto: vi.fn() }));
vi.mock("@/lib/queries/tags.queries", () => ({
  syncTagsForMiembro: vi.fn(),
  bulkAddTagToMiembros: vi.fn(),
}));
vi.mock("@/lib/queries/planes.queries", () => ({ listPlanes: vi.fn() }));

import { getTenant } from "@/lib/tenant";
import { bulkAddTagToMiembros } from "@/lib/queries/tags.queries";
import { createMiembroAction, updateMiembroAction, bulkAsignarTagAction } from "./actions";
import { importarMiembrosAction } from "./importar/actions";

type Plan = "basico" | "pro" | "escala";
type Rol = "owner" | "gerente" | "receptionist" | "entrenador";

vi.spyOn(console, "warn").mockImplementation(() => {});

function tenant(plan: Plan, role: Rol = "owner") {
  vi.mocked(getTenant).mockResolvedValue({ id: "gym-1", slug: "demo", plan, role });
}

const REQUIERE_PRO = "Esta función requiere el plan Pro.";
const TAGS_SIN_PLAN = "Las etiquetas requieren el plan Pro.";
const FORM_VACIO = { ok: false, error: null, fieldErrors: {} };
const UUID = "11111111-1111-4111-8111-111111111111";

function formSocio(conTags: boolean): FormData {
  // Deliberadamente incompleto: si la acción pasa el gate de tags, cae en
  // "Revisa los campos marcados." (parse de Zod), que es la prueba de que
  // llegó al cuerpo sin cerrarse.
  const fd = new FormData();
  fd.set("nombre", "");
  if (conTags) fd.append("tag_ids", UUID);
  return fd;
}

beforeEach(() => {
  vi.mocked(bulkAddTagToMiembros).mockReset();
});

describe("cierre: bulk_actions + tags (bulkAsignarTagAction)", () => {
  it("basico → SIN_PLAN por bulk_actions, sin tocar la query", async () => {
    tenant("basico");
    const r = await bulkAsignarTagAction([UUID], UUID);
    expect(r).toEqual({ ok: false, error: REQUIERE_PRO, code: "SIN_PLAN" });
    expect(bulkAddTagToMiembros).not.toHaveBeenCalled();
  });

  it("pro → pasa a bulkAddTagToMiembros", async () => {
    tenant("pro", "receptionist");
    vi.mocked(bulkAddTagToMiembros).mockResolvedValue({ ok: true });
    expect(await bulkAsignarTagAction([UUID], UUID)).toEqual({ ok: true });
    expect(bulkAddTagToMiembros).toHaveBeenCalledWith("gym-1", [UUID], UUID);
  });

  it("entrenador pro (sin editar_miembros no: sí lo tiene) → pasa; sin rol válido no aplica", async () => {
    tenant("pro", "entrenador");
    vi.mocked(bulkAddTagToMiembros).mockResolvedValue({ ok: true });
    expect(await bulkAsignarTagAction([UUID], UUID)).toEqual({ ok: true });
  });
});

describe("cierre: tags en crear/editar socio (solo si el form trae tag_ids)", () => {
  it("basico + tag_ids → mensaje de plan, con fieldErrors vacío", async () => {
    tenant("basico");
    expect(await createMiembroAction(FORM_VACIO, formSocio(true))).toEqual({
      ok: false,
      error: TAGS_SIN_PLAN,
      fieldErrors: {},
    });
    expect(await updateMiembroAction(UUID, FORM_VACIO, formSocio(true))).toEqual({
      ok: false,
      error: TAGS_SIN_PLAN,
      fieldErrors: {},
    });
  });

  it("basico sin tag_ids → NO se cierra: llega al parse del formulario", async () => {
    tenant("basico");
    const r = await createMiembroAction(FORM_VACIO, formSocio(false));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Revisa los campos marcados.");
    expect(Object.keys(r.fieldErrors).length).toBeGreaterThan(0);
  });

  it("pro + tag_ids → pasa el gate de tags y llega al parse", async () => {
    tenant("pro", "receptionist");
    const r = await createMiembroAction(FORM_VACIO, formSocio(true));
    expect(r.error).toBe("Revisa los campos marcados.");
  });

  it("rol sin crear_miembros no existe; sin editar_miembros tampoco: los cuatro roles crean y editan", async () => {
    for (const role of ["owner", "gerente", "receptionist", "entrenador"] as const) {
      tenant("escala", role);
      const r = await createMiembroAction(FORM_VACIO, formSocio(false));
      expect(r.error).toBe("Revisa los campos marcados.");
    }
  });
});

describe("importar: de owner-only a configurar_general (owner + gerente)", () => {
  it("recepcionista y entrenador → SIN_PERMISO en la forma de ImportResult", async () => {
    for (const role of ["receptionist", "entrenador"] as const) {
      tenant("basico", role);
      const r = await importarMiembrosAction([]);
      expect(r.ok).toBe(false);
      expect(r.errors[0]?.reason).toBe("No tienes permiso para cambiar la configuración.");
    }
  });

  it("gerente → pasa (filas vacías devuelven el resultado vacío sin error)", async () => {
    tenant("basico", "gerente");
    const r = await importarMiembrosAction([]);
    expect(r).toMatchObject({ ok: false, totalProcessed: 0, errors: [] });
  });
});
