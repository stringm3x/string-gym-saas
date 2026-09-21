/**
 * Bloque 05 + bloque 08: cosas de créditos que no se pueden probar a mano
 * sin romper datos reales — marcar un plan como "completado" cuando la
 * última cuota se cobra, el rollback de `planes_pago` cuando falla un paso
 * posterior a crearlo, y (bloque 08) el reclamo atómico de pagarCuota, que
 * la cuota 1 se cobre al crear el plan sin revertirlo si falla, y que el
 * total salga del precio real del plan/producto, nunca del cliente.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/queries/productos.queries", () => ({ aplicarMovimiento: vi.fn() }));
vi.mock("@/lib/queries/pagos.queries", () => ({ createPago: vi.fn() }));
vi.mock("@/lib/utils/membresia-rango", () => ({
  calcularRangoPorDias: vi.fn(() => ({
    periodo_inicio: "2026-01-01",
    periodo_fin: "2026-02-01",
  })),
}));

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { createPago } from "@/lib/queries/pagos.queries";
import {
  createPlanPago,
  createAbonoMembresia,
  pagarCuota,
  getDeudaVencida,
} from "./creditos.queries";

const ERROR = { message: "boom" };

function clienteCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
  vi.mocked(createPago).mockReset();
});

describe("pagarCuota: marcar el plan como completado", () => {
  it("era la última cuota pero el update a 'completado' falla → logError, sigue ok:true", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: true, id: "pago-1", token: "tok" });
    const from = vi
      .fn()
      // 1. cuotas_pago.select (la cuota)
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1", monto: 500, pagado_at: null } })
      )
      // 2. planes_pago.select (el plan)
      .mockReturnValueOnce(
        supaResult({
          data: { id: "plan-1", miembro_id: "m-1", plan_membresia_id: null, producto_id: null },
        })
      )
      // 3. cuotas_pago.select count (pagadas previas) → 1, no es el primer pago
      .mockReturnValueOnce(supaResult({ count: 1 }))
      // 4. cuotas_pago.update (marcar pagada) → funciona
      .mockReturnValueOnce(supaResult({ error: null }))
      // 5. cuotas_pago.select count (pendientes) → 0, era la última
      .mockReturnValueOnce(supaResult({ count: 0 }))
      // 6. planes_pago.update (estado: completado) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await pagarCuota("t-1", "cuota-1", "efectivo");

    expect(r).toEqual({
      ok: true,
      pagoId: "pago-1",
      planCompletado: true,
      reciboError: undefined,
    });
    expect(logError).toHaveBeenCalledWith(
      "credito.marcar_plan_completado_fallo",
      expect.objectContaining({ tenantId: "t-1", planPagoId: "plan-1" })
    );
  });

  it("el update funciona → sin logError", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: true, id: "pago-1", token: "tok" });
    const from = vi
      .fn()
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1", monto: 500, pagado_at: null } })
      )
      .mockReturnValueOnce(
        supaResult({
          data: { id: "plan-1", miembro_id: "m-1", plan_membresia_id: null, producto_id: null },
        })
      )
      .mockReturnValueOnce(supaResult({ count: 1 }))
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ count: 0 }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await pagarCuota("t-1", "cuota-1", "efectivo");

    expect(r.ok).toBe(true);
    expect(logError).not.toHaveBeenCalled();
  });
});

describe("pagarCuota: reclamo atómico (bloque 08) — no cobra dos veces la misma cuota", () => {
  it("el reclamo (UPDATE ... WHERE pagado_at IS NULL) no encuentra fila → 'ya está pagada', createPago NUNCA se llama", async () => {
    // Simula la carrera: otra llamada concurrente ya reclamó la cuota entre
    // que esta empezó y llegó a este punto — el UPDATE condicional no
    // afecta ninguna fila, a diferencia de un SELECT previo que sí la
    // habría visto "pagable" un instante antes.
    const from = vi.fn().mockReturnValueOnce(supaResult({ data: null, error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await pagarCuota("t-1", "cuota-1", "efectivo");

    expect(r).toEqual({ ok: false, error: "La cuota ya está pagada." });
    expect(from).toHaveBeenCalledTimes(1);
    expect(createPago).not.toHaveBeenCalled();
  });

  it("createPago falla después de reclamar → revierte el reclamo (pagado_at vuelve a null), no queda a medias", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: false, error: "Fondos insuficientes." });
    const from = vi
      .fn()
      // 1. reclamo → gana
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1", monto: 500 } })
      )
      // 2. planes_pago.select
      .mockReturnValueOnce(
        supaResult({
          data: { id: "plan-1", miembro_id: "m-1", plan_membresia_id: null, producto_id: null },
        })
      )
      // 3. cuotas_pago count pagadasPrevias
      .mockReturnValueOnce(supaResult({ count: 0 }))
      // 4. revertirClaim: cuotas_pago.update(pagado_at: null)
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await pagarCuota("t-1", "cuota-1", "efectivo");

    expect(r).toEqual({ ok: false, error: "Fondos insuficientes." });
    expect(from).toHaveBeenCalledTimes(4);
  });
});

describe("createPlanPago: el total sale del precio real, nunca del cliente (bloque 08)", () => {
  it("membresía: el insert de planes_pago usa el precio del plan_membresia, no un total inventado", async () => {
    const insert = vi.fn().mockReturnValue(supaResult({ error: ERROR }));
    const from = vi
      .fn()
      // 1. planes_membresia.select precio
      .mockReturnValueOnce(supaResult({ data: { precio: "1234.50" } }))
      // 2. planes_pago.insert — capturado para revisar el payload
      .mockReturnValueOnce({ insert });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await createPlanPago("t-1", {
      miembro_id: "m-1",
      tipo: "membresia",
      plan_membresia_id: "pm-1",
      cuotas: 4,
      frecuencia: "quincenal",
      metodo: "efectivo",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ total: 1234.5 })
    );
  });

  it("producto: el total es precio × cantidad, no lo que mande el cliente", async () => {
    const insert = vi.fn().mockReturnValue(supaResult({ error: ERROR }));
    const from = vi
      .fn()
      // 1. productos.select precio
      .mockReturnValueOnce(supaResult({ data: { precio: "100" } }))
      // 2. planes_pago.insert — capturado
      .mockReturnValueOnce({ insert });
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    await createPlanPago("t-1", {
      miembro_id: "m-1",
      tipo: "producto",
      producto_id: "p-1",
      cantidad: 3,
      cuotas: 2,
      frecuencia: "quincenal",
      metodo: "efectivo",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ total: 300 })
    );
  });

  it("plan de membresía no encontrado → error, ni siquiera intenta crear el plan", async () => {
    const from = vi.fn().mockReturnValueOnce(supaResult({ data: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createPlanPago("t-1", {
      miembro_id: "m-1",
      tipo: "membresia",
      plan_membresia_id: "pm-inexistente",
      cuotas: 4,
      frecuencia: "quincenal",
      metodo: "efectivo",
    });

    expect(r).toEqual({ ok: false, error: "Plan de membresía no encontrado." });
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("createPlanPago: rollback si fallan las cuotas", () => {
  it("insertar las cuotas falla Y el delete de limpieza también falla → logError, plan huérfano visible en logs", async () => {
    const from = vi
      .fn()
      // 1. planes_membresia.select precio
      .mockReturnValueOnce(supaResult({ data: { precio: "1000" } }))
      // 2. planes_pago.insert
      .mockReturnValueOnce(supaResult({ data: { id: "plan-1" }, error: null }))
      // 3. cuotas_pago.insert → falla
      .mockReturnValueOnce(supaResult({ error: ERROR, data: null }))
      // 4. planes_pago.delete (rollback) → TAMBIÉN falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createPlanPago("t-1", {
      miembro_id: "m-1",
      tipo: "membresia",
      plan_membresia_id: "pm-1",
      cuotas: 4,
      frecuencia: "quincenal",
      metodo: "efectivo",
    });

    expect(r).toEqual({ ok: false, error: "boom" });
    expect(logError).toHaveBeenCalledWith(
      "credito.rollback_plan_huerfano",
      expect.objectContaining({
        tenantId: "t-1",
        planId: "plan-1",
        motivo: "cuotas_insert_fallo",
      })
    );
  });

  it("insertar las cuotas falla pero el delete de limpieza SÍ funciona → sin logError", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: { precio: "1000" } }))
      .mockReturnValueOnce(supaResult({ data: { id: "plan-1" }, error: null }))
      .mockReturnValueOnce(supaResult({ error: ERROR, data: null }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createPlanPago("t-1", {
      miembro_id: "m-1",
      tipo: "membresia",
      plan_membresia_id: "pm-1",
      cuotas: 4,
      frecuencia: "quincenal",
      metodo: "efectivo",
    });

    expect(r).toEqual({ ok: false, error: "boom" });
    expect(logError).not.toHaveBeenCalled();
  });
});

describe("createPlanPago: cobra la cuota 1 al crear el plan (bloque 08)", () => {
  it("cuota 1 falla al cobrarse → ok:true con cuota1Error (el plan SÍ se creó, no es un fallo total)", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: false, error: "Fondos insuficientes." });
    const from = vi
      .fn()
      // 1. planes_membresia.select precio
      .mockReturnValueOnce(supaResult({ data: { precio: "1000" } }))
      // 2. planes_pago.insert
      .mockReturnValueOnce(supaResult({ data: { id: "plan-1" }, error: null }))
      // 3. cuotas_pago.insert().select()
      .mockReturnValueOnce(
        supaResult({
          data: [
            { id: "cuota-1", numero_cuota: 1 },
            { id: "cuota-2", numero_cuota: 2 },
          ],
          error: null,
        })
      )
      // --- dentro de pagarCuota(cuota-1) ---
      // 4. reclamo (gana)
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1", monto: 500 } })
      )
      // 5. planes_pago.select (plan_membresia_id null → sin extensión de vigencia)
      .mockReturnValueOnce(
        supaResult({
          data: { id: "plan-1", miembro_id: "m-1", plan_membresia_id: null, producto_id: null },
        })
      )
      // 6. cuotas_pago count pagadasPrevias
      .mockReturnValueOnce(supaResult({ count: 0 }))
      // 7. revertirClaim (pagado_at: null) tras el fallo de createPago
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createPlanPago("t-1", {
      miembro_id: "m-1",
      tipo: "membresia",
      plan_membresia_id: "pm-1",
      cuotas: 2,
      frecuencia: "quincenal",
      metodo: "efectivo",
    });

    // ok:true — el plan y sus cuotas YA EXISTEN, el error de pagarCuota
    // viaja aparte (cuota1Error), no como fallo total: devolver ok:false
    // acá le hacía creer al caller que nada pasó (sin refrescar ni avisar
    // del plan real que quedó a medias), con la puerta abierta a
    // reintentar "Crear plan" y duplicar el registro.
    expect(r).toEqual({
      ok: true,
      id: "plan-1",
      cuota1Error: "Fondos insuficientes.",
    });
    // NO se llamó borrarPlanPagoHuerfano (no hay un 8vo from() de
    // planes_pago.delete): el plan y sus cuotas quedan, cuota 1 pendiente,
    // cobrable de nuevo desde la tarjeta del plan.
    expect(from).toHaveBeenCalledTimes(7);
    expect(logError).not.toHaveBeenCalledWith(
      "credito.rollback_plan_huerfano",
      expect.anything()
    );
  });
});

describe("getDeudaVencida: solo avisa, nunca bloquea (bloque 08)", () => {
  it("sin planes activos → null, ni siquiera consulta cuotas", async () => {
    const from = vi.fn().mockReturnValueOnce(supaResult({ data: [] }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await getDeudaVencida("t-1", "m-1", clienteCon(from));

    expect(r).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("hay cuotas vencidas sin pagar → suma el monto y el conteo", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ data: [{ id: "plan-1" }] }))
      .mockReturnValueOnce(
        supaResult({ data: [{ monto: 500 }, { monto: 250 }] })
      );
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await getDeudaVencida("t-1", "m-1", clienteCon(from));

    expect(r).toEqual({ monto: 750, cuotas: 2 });
  });
});

describe("createAbonoMembresia: mismo rollback, mismo helper", () => {
  it("insertar las cuotas del abono falla Y el rollback también falla → logError", async () => {
    const from = vi
      .fn()
      // 1. planes_membresia.select
      .mockReturnValueOnce(
        supaResult({ data: { id: "pm-1", nombre: "Mensual", precio: "1000", dias_duracion: 30 } })
      )
      // 2. miembros.select
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: null } }))
      // 3. planes_pago.insert
      .mockReturnValueOnce(supaResult({ data: { id: "plan-1" }, error: null }))
      // 4. cuotas_pago.insert → falla
      .mockReturnValueOnce(supaResult({ error: ERROR, data: null }))
      // 5. planes_pago.delete (rollback) → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createAbonoMembresia("t-1", {
      miembroId: "m-1",
      planMembresiaId: "pm-1",
      montoPagado: 300,
      metodoPago: "efectivo",
    });

    expect(r).toEqual({ ok: false, error: "boom" });
    expect(logError).toHaveBeenCalledWith(
      "credito.rollback_plan_huerfano",
      expect.objectContaining({
        tenantId: "t-1",
        planId: "plan-1",
        motivo: "cuotas_insert_fallo",
      })
    );
  });

  it("cuota 1 falla al cobrarse → ok:true con cuota1Error, sin pagoId (mismo criterio que createPlanPago)", async () => {
    vi.mocked(createPago).mockResolvedValue({ ok: false, error: "Fondos insuficientes." });
    const from = vi
      .fn()
      .mockReturnValueOnce(
        supaResult({ data: { id: "pm-1", nombre: "Mensual", precio: "1000", dias_duracion: 30 } })
      )
      .mockReturnValueOnce(supaResult({ data: { fecha_vencimiento: null } }))
      .mockReturnValueOnce(supaResult({ data: { id: "plan-1" }, error: null }))
      .mockReturnValueOnce(
        supaResult({
          data: [
            { id: "cuota-1", numero_cuota: 1 },
            { id: "cuota-2", numero_cuota: 2 },
          ],
          error: null,
        })
      )
      // --- dentro de pagarCuota(cuota-1) ---
      .mockReturnValueOnce(
        supaResult({ data: { id: "cuota-1", plan_id: "plan-1", monto: 300 } })
      )
      .mockReturnValueOnce(
        supaResult({
          data: { id: "plan-1", miembro_id: "m-1", plan_membresia_id: null, producto_id: null },
        })
      )
      .mockReturnValueOnce(supaResult({ count: 0 }))
      // revertirClaim tras el fallo de createPago
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createClient).mockResolvedValue(clienteCon(from));

    const r = await createAbonoMembresia("t-1", {
      miembroId: "m-1",
      planMembresiaId: "pm-1",
      montoPagado: 300,
      metodoPago: "efectivo",
    });

    // ok:true — el abono/plan ya existe. Antes esto era ok:false, lo que
    // le hacía creer al staff que nada pasó y dejaba la puerta abierta a
    // reintentar "Registrar abono" y crear un segundo plan huérfano.
    expect(r).toEqual({
      ok: true,
      montoRestante: 700,
      cuota1Error: "Fondos insuficientes.",
    });
    expect(logError).not.toHaveBeenCalledWith(
      "credito.rollback_plan_huerfano",
      expect.anything()
    );
  });
});
