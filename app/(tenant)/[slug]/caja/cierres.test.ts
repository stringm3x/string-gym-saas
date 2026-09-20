/**
 * Cierres de feature del PR 4 (caja), probados contra las acciones reales
 * con el plan mockeado. Las tres features que la migración empieza a
 * exigir (inventario, creditos, kiosco_autoservicio) tienen uso real casi
 * nulo en los tenants vivos (sql/reportes/uso-features-pr4-caja.sql), así
 * que el cierre no lo ha ejercido nadie: aquí se verifica que con `basico`
 * se niega con el mensaje correcto y con `pro` la acción sigue su curso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getTenant: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/queries/pagos.queries", () => ({
  createPago: vi.fn(),
  createVisitaRapida: vi.fn(),
  anularPago: vi.fn(),
  registrarTicket: vi.fn(),
  pagoMembresiaReciente: vi.fn(),
}));
vi.mock("@/lib/queries/planes.queries", () => ({ getPlan: vi.fn() }));
vi.mock("@/lib/queries/reembolsos.queries", () => ({ crearReembolso: vi.fn() }));
vi.mock("@/lib/queries/notas-credito.queries", () => ({
  getCreditoDisponible: vi.fn(),
  aplicarCredito: vi.fn(),
}));
vi.mock("@/lib/queries/creditos.queries", () => ({ createAbonoMembresia: vi.fn() }));
vi.mock("@/lib/queries/cajas.queries", () => ({ resolverCajaDeVenta: vi.fn() }));
vi.mock("@/lib/queries/staff.queries", () => ({ getActiveStaff: vi.fn() }));
vi.mock("@/lib/queries/miembros.queries", () => ({ getMiembro: vi.fn() }));
vi.mock("@/lib/queries/gyms.queries", () => ({ getGymFull: vi.fn() }));
vi.mock("@/lib/queries/marca.queries", () => ({ getGymMarca: vi.fn() }));
vi.mock("@/lib/email/send-recibo", () => ({ sendRecibo: vi.fn() }));
vi.mock("@/lib/queries/kiosco.queries", () => ({
  autorizarCodigo: vi.fn(),
  rechazarCodigo: vi.fn(),
}));

import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { createPago, registrarTicket } from "@/lib/queries/pagos.queries";
import { createAbonoMembresia } from "@/lib/queries/creditos.queries";
import { resolverCajaDeVenta } from "@/lib/queries/cajas.queries";
import { autorizarCodigo, rechazarCodigo } from "@/lib/queries/kiosco.queries";
import {
  registerPagoAction,
  registrarTicketAction,
  registrarAbonoAction,
} from "./actions";
import { autorizarCodigoAction, rechazarCodigoAction } from "./autorizaciones-actions";

type Plan = "basico" | "pro" | "escala";
type Rol = "owner" | "gerente" | "receptionist" | "entrenador";

vi.spyOn(console, "warn").mockImplementation(() => {});

function tenant(plan: Plan, role: Rol = "owner") {
  vi.mocked(getTenant).mockResolvedValue({ id: "gym-1", slug: "demo", plan, role });
}

const REQUIERE_PRO = "Esta función requiere el plan Pro.";
const PRODUCTOS_SIN_PLAN = "La venta de productos requiere el plan Pro.";
const PAGO_VACIO = { ok: false, error: null, fieldErrors: {} };
const UUID = "11111111-1111-4111-8111-111111111111";

function formProducto(): FormData {
  const fd = new FormData();
  fd.set("concepto", "producto");
  fd.set("producto_id", UUID);
  fd.set("cantidad_producto", "1");
  fd.set("monto", "50");
  fd.set("metodo_pago", "efectivo");
  return fd;
}

function formVisita(): FormData {
  const fd = new FormData();
  fd.set("concepto", "visita");
  fd.set("monto", "50");
  fd.set("metodo_pago", "efectivo");
  fd.set("nombre_visitante", "Ana");
  return fd;
}

beforeEach(() => {
  vi.mocked(createPago).mockReset();
  vi.mocked(registrarTicket).mockReset();
  vi.mocked(createAbonoMembresia).mockReset();
  vi.mocked(resolverCajaDeVenta).mockReset().mockResolvedValue(null);
  vi.mocked(autorizarCodigo).mockReset();
  vi.mocked(rechazarCodigo).mockReset();
});

describe("cierre: creditos (registrarAbonoAction)", () => {
  it("basico → SIN_PLAN con el mensaje correcto, sin tocar la query", async () => {
    tenant("basico");
    const r = await registrarAbonoAction("m-1", "p-1", 100, "efectivo");
    expect(r).toEqual({ ok: false, error: REQUIERE_PRO, code: "SIN_PLAN" });
    expect(createAbonoMembresia).not.toHaveBeenCalled();
  });

  it("pro → pasa a createAbonoMembresia", async () => {
    tenant("pro", "receptionist");
    vi.mocked(createAbonoMembresia).mockResolvedValue({ ok: true, pagoId: "pg-1", montoRestante: 200 });
    const r = await registrarAbonoAction("m-1", "p-1", 100, "efectivo");
    expect(r).toEqual({ ok: true, pagoId: "pg-1", montoRestante: 200 });
    expect(createAbonoMembresia).toHaveBeenCalledWith("gym-1", expect.objectContaining({ miembroId: "m-1" }));
  });
});

describe("cierre: inventario (ticket con productos)", () => {
  const conProductos = {
    metodo: "efectivo" as const,
    miembroId: null,
    productos: [{ producto_id: UUID, cantidad: 2 }],
    membresia: null,
  };

  it("basico + productos → mensaje de plan, sin consultar precios", async () => {
    tenant("basico");
    const r = await registrarTicketAction(conProductos);
    expect(r).toEqual({ ok: false, error: PRODUCTOS_SIN_PLAN });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("basico + solo membresía → NO se cierra (es caja básica)", async () => {
    tenant("basico");
    vi.mocked(createClient).mockResolvedValue({} as never);
    const r = await registrarTicketAction({
      metodo: "efectivo",
      miembroId: null,
      productos: [],
      membresia: { plan_id: "plan-1" },
    });
    // Llega al cuerpo: falla por falta de miembro, no por plan.
    expect(r).toEqual({ ok: false, error: "La membresía requiere un miembro." });
  });

  it("pro + productos → pasa a registrarTicket con el precio de la BD", async () => {
    tenant("pro", "receptionist");
    const inQ = vi.fn().mockResolvedValue({ data: [{ id: UUID, precio: "10" }] });
    vi.mocked(createClient).mockResolvedValue({
      from: () => ({ select: () => ({ eq: () => ({ in: inQ }) }) }),
    } as never);
    vi.mocked(registrarTicket).mockResolvedValue({ ok: true, ticketId: "t-1", token: "tok" });
    const r = await registrarTicketAction(conProductos);
    expect(r).toEqual({ ok: true, ticketId: "t-1" });
    expect(registrarTicket).toHaveBeenCalledWith(
      "gym-1",
      expect.objectContaining({
        items: [expect.objectContaining({ tipo: "producto", cantidad: 2, monto: 20 })],
      })
    );
  });
});

describe("cierre: inventario (cobro rápido con concepto producto)", () => {
  it("basico → mensaje de plan con fieldErrors vacío", async () => {
    tenant("basico");
    const r = await registerPagoAction(PAGO_VACIO, formProducto());
    expect(r).toEqual({ ok: false, error: PRODUCTOS_SIN_PLAN, fieldErrors: {} });
    expect(resolverCajaDeVenta).not.toHaveBeenCalled();
  });

  it("basico + visita → NO se cierra (caja básica)", async () => {
    tenant("basico");
    vi.mocked(createPago).mockResolvedValue({ ok: false, error: "SENTINEL" });
    const { createVisitaRapida } = await import("@/lib/queries/pagos.queries");
    vi.mocked(createVisitaRapida).mockResolvedValue({ ok: false, error: "SENTINEL_VISITA" });
    const r = await registerPagoAction(PAGO_VACIO, formVisita());
    expect(r).toEqual({ ok: false, error: "SENTINEL_VISITA", fieldErrors: {} });
  });

  it("pro → pasa el gate y llega a createPago", async () => {
    tenant("pro", "receptionist");
    vi.mocked(createPago).mockResolvedValue({ ok: false, error: "SENTINEL_CREATE_PAGO" });
    const r = await registerPagoAction(PAGO_VACIO, formProducto());
    expect(r).toEqual({ ok: false, error: "SENTINEL_CREATE_PAGO", fieldErrors: {} });
    expect(createPago).toHaveBeenCalledOnce();
  });

  it("entrenador (sin registrar_pagos) → SIN_PERMISO antes de parsear", async () => {
    tenant("escala", "entrenador");
    const r = await registerPagoAction(PAGO_VACIO, formProducto());
    expect(r).toEqual({ ok: false, error: "No tienes permiso para cobrar.", fieldErrors: {} });
  });
});

describe("cierre: kiosco_autoservicio (autorizar / rechazar código)", () => {
  it("basico → SIN_PLAN en ambas, sin tocar la query", async () => {
    tenant("basico");
    expect(await autorizarCodigoAction("c-1")).toEqual({ ok: false, error: REQUIERE_PRO, code: "SIN_PLAN" });
    expect(await rechazarCodigoAction("c-1")).toEqual({ ok: false, error: REQUIERE_PRO, code: "SIN_PLAN" });
    expect(autorizarCodigo).not.toHaveBeenCalled();
    expect(rechazarCodigo).not.toHaveBeenCalled();
  });

  it("pro → pasa a la query", async () => {
    tenant("pro", "receptionist");
    vi.mocked(autorizarCodigo).mockResolvedValue({ ok: true, tipo: "compra" });
    vi.mocked(rechazarCodigo).mockResolvedValue({ ok: true });
    expect(await autorizarCodigoAction("c-1")).toEqual({ ok: true, tipo: "compra" });
    expect(await rechazarCodigoAction("c-1")).toEqual({ ok: true });
  });
});
