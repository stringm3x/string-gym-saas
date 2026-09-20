import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenant: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/queries/qr.queries", () => ({ getMiembroByQrToken: vi.fn() }));
vi.mock("@/lib/queries/portal.queries", () => ({ getPortalGym: vi.fn() }));
vi.mock("@/lib/portal/session", () => ({ getPortalSession: vi.fn() }));
vi.mock("@/lib/admin/helpers", () => ({ getCurrentAdmin: vi.fn() }));

import { getTenant } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMiembroByQrToken } from "@/lib/queries/qr.queries";
import { getPortalGym } from "@/lib/queries/portal.queries";
import { getPortalSession } from "@/lib/portal/session";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import { panelAction, kioscoAction, adminAction, anonAction } from "./index";
import { AUTHZ, type Denegado } from "./tipos";

type Cobro =
  | { ok: true; total: number; tenantId: string; puedeAnular: boolean }
  | Denegado;

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

beforeEach(() => {
  vi.mocked(getTenant).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(getMiembroByQrToken).mockReset();
  vi.mocked(getPortalGym).mockReset();
  vi.mocked(getPortalSession).mockReset();
  vi.mocked(getCurrentAdmin).mockReset();
  warn.mockClear();
});

function tenant(plan: "basico" | "pro" | "escala", role: "owner" | "gerente" | "receptionist" | "entrenador") {
  vi.mocked(getTenant).mockResolvedValue({ id: "gym-1", slug: "demo", plan, role });
}

describe("panelAction", () => {
  // Forma que absorbe Denegado → onDenied opcional.
  const cobrar = panelAction("caja.cobrar", {}, async (ctx, monto: number): Promise<Cobro> => ({
    ok: true,
    total: monto,
    tenantId: ctx.id,
    puedeAnular: ctx.can("cancelar_pagos"),
  }));

  it("marca la función con su clase", () => {
    expect(cobrar[AUTHZ]).toBe("panel");
  });

  it("deja pasar con feature y permiso, y expone ctx.can", async () => {
    tenant("basico", "receptionist");
    const r = await cobrar(100);
    expect(r).toEqual({ ok: true, total: 100, tenantId: "gym-1", puedeAnular: false });
    expect(warn).not.toHaveBeenCalled();
  });

  it("niega por rol con SIN_PERMISO y mensaje legible", async () => {
    tenant("escala", "entrenador");
    const r = await cobrar(100);
    expect(r).toEqual({
      ok: false,
      code: "SIN_PERMISO",
      error: "No tienes permiso para cobrar.",
    });
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({
      tag: "authz.denied",
      kind: "panel",
      politica: "caja.cobrar",
      code: "SIN_PERMISO",
      role: "entrenador",
    });
  });

  it("niega por plan con SIN_PLAN antes que por rol", async () => {
    tenant("basico", "entrenador");
    const mp = panelAction("caja.cobrar_mp", {}, async () => ({ ok: true }));
    const r = await mp();
    expect(r).toEqual({
      ok: false,
      code: "SIN_PLAN",
      error: "Esta función requiere el plan Pro.",
    });
  });

  it("usa onDenied cuando la forma de retorno no absorbe Denegado", async () => {
    tenant("pro", "entrenador");
    const saldo = panelAction(
      "caja.credito_disponible",
      { onDenied: () => 0 },
      async () => 250
    );
    expect(await saldo()).toBe(0);
    tenant("pro", "receptionist");
    expect(await saldo()).toBe(250);
  });
});

describe("kioscoAction", () => {
  function gymPorSlug(gym: object | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: gym });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(createAdminClient).mockReturnValue({ from } as never);
  }
  const gymPro = { id: "gym-1", slug: "demo", plan: "pro", checkin_bloquea_vencidos: null, mp_access_token: null };
  const socio = { id: "m-1", nombre: "Ana", telefono: null, fecha_vencimiento: null, archivado: false, plan_id: null };

  // Forma tipo kiosco que NO absorbe Denegado (sin `code`, `ok: true` con
  // otros campos) → tsc exige onDenied.
  type Codigo = { ok: true; miembroId: string; items: number } | { ok: false; error: string };
  const compra = kioscoAction(
    "kiosco.codigo_compra",
    { onDenied: (d) => ({ ok: false as const, error: d.error }) },
    async (ctx, input: { items: number }): Promise<Codigo> => ({
      ok: true,
      miembroId: ctx.miembro.id,
      items: input.items,
    })
  );

  it("firma pública (slug, token, input): el socio sale del token, no del input", async () => {
    gymPorSlug(gymPro);
    vi.mocked(getMiembroByQrToken).mockResolvedValue(socio);
    const r = await compra("demo", "  tok-1 ", { items: 2 });
    expect(r).toEqual({ ok: true, miembroId: "m-1", items: 2 });
    expect(getMiembroByQrToken).toHaveBeenCalledWith("gym-1", "tok-1", expect.anything());
  });

  it("token inválido → IDENTIDAD_INVALIDA por onDenied", async () => {
    gymPorSlug(gymPro);
    vi.mocked(getMiembroByQrToken).mockResolvedValue(null);
    const r = await compra("demo", "tok-x", { items: 1 });
    expect(r).toEqual({
      ok: false,
      error: "No se pudo verificar tu identidad. Vuelve a escanear tu QR.",
    });
  });

  it("gym sin la feature → SIN_PLAN, sin consultar el token", async () => {
    gymPorSlug({ ...gymPro, plan: "basico" });
    const r = await compra("demo", "tok-1", { items: 1 });
    expect(r).toEqual({ ok: false, error: "Esta función requiere el plan Pro." });
    expect(getMiembroByQrToken).not.toHaveBeenCalled();
  });

  it("gym inexistente → GYM_NO_ENCONTRADO", async () => {
    gymPorSlug(null);
    const r = await compra("nadie", "tok-1", { items: 1 });
    expect(r).toEqual({ ok: false, error: "Gimnasio no encontrado." });
  });
});

describe("adminAction", () => {
  const base = { user_id: "u-1", email: "a@string.mx", nombre: null, activo: true, created_at: "", ultimo_acceso: null };
  type Cancelado = { ok: true; por: string; tenantId: string } | Denegado;
  const cancelar = adminAction(
    "admin.cancelar_tenant",
    {},
    async ({ admin }, tenantId: string): Promise<Cancelado> => ({
      ok: true,
      por: admin.email,
      tenantId,
    })
  );
  const nota = adminAction("admin.nota_interna", {}, async () => ({ ok: true }));

  it("sin sesión de admin → SIN_SESION", async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null);
    expect(await cancelar("t-1")).toEqual({ ok: false, code: "SIN_SESION", error: "Acceso denegado." });
  });

  it("admin de soporte no puede lo de super_admin, pero sí lo de admin", async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ ...base, role: "admin" });
    expect(await cancelar("t-1")).toMatchObject({ ok: false, code: "SIN_PERMISO" });
    expect(await nota()).toEqual({ ok: true });
  });

  it("super_admin pasa y recibe ctx.admin", async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ ...base, role: "super_admin" });
    expect(await cancelar("t-1")).toEqual({ ok: true, por: "a@string.mx", tenantId: "t-1" });
  });
});

describe("anonAction", () => {
  it("no verifica nada y queda marcada como anon con su propósito", async () => {
    const login = anonAction("login_staff", async (email: string) => ({ ok: true, email }));
    expect(await login("a@b.c")).toEqual({ ok: true, email: "a@b.c" });
    expect(login[AUTHZ]).toBe("anon");
    expect(login.proposito).toBe("login_staff");
  });
});
