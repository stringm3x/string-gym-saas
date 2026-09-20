/**
 * Cierres de feature del PR 7 (resto del panel), probados contra las
 * acciones reales con el plan mockeado. Uso real en los tenants vivos: cero
 * (docs/autorizacion-acciones.md §8). basico → SIN_PLAN sin tocar la query;
 * pro → la acción sigue su curso. También: usar_panel deja pasar a los
 * cuatro roles, y las notas de prospecto exigen ver_prospectos en el cuerpo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getTenant: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/queries/productos.queries", () => ({
  createProducto: vi.fn(),
  updateProducto: vi.fn(),
  aplicarMovimiento: vi.fn(),
}));
vi.mock("@/lib/queries/notas.queries", () => ({
  createNota: vi.fn(),
  listNotas: vi.fn(),
  toggleNotaCompletada: vi.fn(),
}));
vi.mock("@/lib/queries/prospectos.queries", () => ({
  createProspecto: vi.fn(),
  updateProspecto: vi.fn(),
  updateEstadoProspecto: vi.fn(),
}));
vi.mock("@/lib/queries/tags.queries", () => ({ syncTagsForProspecto: vi.fn() }));
vi.mock("@/lib/queries/negocio.queries", () => ({ getReporteFinanciero: vi.fn() }));
vi.mock("@/lib/queries/inbox.queries", () => ({
  marcarConversacionLeida: vi.fn(),
  toggleBot: vi.fn(),
  enviarMensajeManual: vi.fn(),
}));

import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { listNotas } from "@/lib/queries/notas.queries";
import { updateEstadoProspecto } from "@/lib/queries/prospectos.queries";
import { getReporteFinanciero } from "@/lib/queries/negocio.queries";
import { marcarConversacionLeida } from "@/lib/queries/inbox.queries";
import { createProductoAction } from "./inventario/actions";
import { listNotasAction } from "./notas/actions";
import { cambiarEstadoAction } from "./prospectos/actions";
import { getReporteCsvAction } from "./reportes/financiero/actions";
import { marcarTodasLeidasAction } from "./notificaciones-actions";
import { marcarLeidaAction } from "./comunicaciones/whatsapp/actions";

type Plan = "basico" | "pro" | "escala";
type Rol = "owner" | "gerente" | "receptionist" | "entrenador";
const ROLES: Rol[] = ["owner", "gerente", "receptionist", "entrenador"];

vi.spyOn(console, "warn").mockImplementation(() => {});

function tenant(plan: Plan, role: Rol = "owner") {
  vi.mocked(getTenant).mockResolvedValue({ id: "gym-1", slug: "demo", plan, role });
}

const REQUIERE_PRO = "Esta función requiere el plan Pro.";
const SIN_PLAN = { ok: false, error: REQUIERE_PRO, code: "SIN_PLAN" };
const FORM_VACIO = { ok: false, error: null, fieldErrors: {} };

beforeEach(() => {
  vi.mocked(listNotas).mockReset();
  vi.mocked(updateEstadoProspecto).mockReset();
  vi.mocked(getReporteFinanciero).mockReset();
  vi.mocked(marcarConversacionLeida).mockReset();
});

describe("cierre: inventario (createProductoAction)", () => {
  it("basico → mensaje de plan con fieldErrors vacío; pro → llega al parse", async () => {
    tenant("basico");
    expect(await createProductoAction(FORM_VACIO, new FormData())).toEqual({
      ok: false,
      error: REQUIERE_PRO,
      fieldErrors: {},
    });
    tenant("pro");
    expect((await createProductoAction(FORM_VACIO, new FormData())).error).toBe("Revisa los campos.");
  });

  it("recepcionista (sin ver_inventario_movimientos) → SIN_PERMISO aunque sea pro", async () => {
    tenant("pro", "receptionist");
    expect((await createProductoAction(FORM_VACIO, new FormData())).error).toBe(
      "No tienes permiso para ver los movimientos de inventario."
    );
  });
});

describe("cierre: timeline_notas (listNotasAction) + usar_panel + ver_prospectos en el cuerpo", () => {
  it("basico → [] por onDenied, sin tocar la query", async () => {
    tenant("basico");
    expect(await listNotasAction("miembro", "m-1")).toEqual([]);
    expect(listNotas).not.toHaveBeenCalled();
  });

  it("pro: notas de MIEMBRO pasan para los cuatro roles (usar_panel)", async () => {
    vi.mocked(listNotas).mockResolvedValue([]);
    for (const role of ROLES) {
      tenant("pro", role);
      await listNotasAction("miembro", "m-1");
    }
    expect(listNotas).toHaveBeenCalledTimes(4);
  });

  it("pro: notas de PROSPECTO solo para owner y gerente (ver_prospectos)", async () => {
    vi.mocked(listNotas).mockResolvedValue([]);
    tenant("pro", "receptionist");
    expect(await listNotasAction("prospecto", "p-1")).toEqual([]);
    tenant("pro", "entrenador");
    expect(await listNotasAction("prospecto", "p-1")).toEqual([]);
    expect(listNotas).not.toHaveBeenCalled();
    tenant("pro", "gerente");
    await listNotasAction("prospecto", "p-1");
    expect(listNotas).toHaveBeenCalledOnce();
  });
});

describe("cierre: prospectos (cambiarEstadoAction)", () => {
  it("basico → SIN_PLAN; pro → pasa a la query", async () => {
    tenant("basico");
    expect(await cambiarEstadoAction("p-1", "contactado")).toEqual(SIN_PLAN);
    expect(updateEstadoProspecto).not.toHaveBeenCalled();
    tenant("pro", "gerente");
    vi.mocked(updateEstadoProspecto).mockResolvedValue({ ok: true });
    expect(await cambiarEstadoAction("p-1", "contactado")).toEqual({ ok: true });
  });
});

describe("cierre: reportes (getReporteCsvAction)", () => {
  it("basico → SIN_PLAN; entrenador pro → SIN_PERMISO; owner pro → llega a la query", async () => {
    tenant("basico");
    expect(await getReporteCsvAction("2026-09-01", "2026-09-19")).toEqual(SIN_PLAN);
    tenant("pro", "entrenador");
    expect(await getReporteCsvAction("2026-09-01", "2026-09-19")).toMatchObject({ code: "SIN_PERMISO" });
    expect(getReporteFinanciero).not.toHaveBeenCalled();
    tenant("pro");
    vi.mocked(getReporteFinanciero).mockRejectedValue(new Error("SENTINEL_REPORTE"));
    await expect(getReporteCsvAction("2026-09-01", "2026-09-19")).rejects.toThrow("SENTINEL_REPORTE");
  });
});

describe("usar_panel: cualquier staff autenticado", () => {
  it("notificaciones: los cuatro roles pasan en Starter", async () => {
    const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
    vi.mocked(createClient).mockResolvedValue({
      from: () => ({ update: () => ({ eq }) }),
    } as never);
    for (const role of ROLES) {
      tenant("basico", role);
      expect(await marcarTodasLeidasAction()).toEqual({ ok: true });
    }
  });

  it("inbox de WhatsApp: los cuatro roles pasan en Escala; en Pro se cierra por plan", async () => {
    vi.mocked(marcarConversacionLeida).mockResolvedValue(undefined as never);
    for (const role of ROLES) {
      tenant("escala", role);
      expect(await marcarLeidaAction("c-1")).toEqual({ ok: true });
    }
    tenant("pro");
    expect(await marcarLeidaAction("c-1")).toEqual({
      ok: false,
      error: "Esta función requiere el plan Escala.",
      code: "SIN_PLAN",
    });
  });
});
