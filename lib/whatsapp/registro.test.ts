/**
 * Hallazgo del barrido por el patrón de logApiRequest (bloque 05): un
 * `try/catch` alrededor de escrituras de Supabase que resuelven con
 * `{ error }` en vez de rechazar la promesa nunca dispara el catch — da
 * falsa seguridad. registrarMensaje tenía el mismo patrón en sus tres
 * escrituras (upsert, update, insert).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supaResult } from "@/lib/testing/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import { registrarMensaje } from "./registro";

const ERROR = { message: "boom" };

function adminCon(from: ReturnType<typeof vi.fn>) {
  return { from } as never;
}

beforeEach(() => {
  vi.mocked(logError).mockReset();
});

describe("registrarMensaje: las tres escrituras ahora sí se revisan", () => {
  it("falla el upsert de wa_conversaciones → logError, sin lanzar (el catch de antes nunca lo veía)", async () => {
    const from = vi
      .fn()
      // 1. wa_conversaciones.upsert → falla
      .mockReturnValueOnce(supaResult({ error: ERROR }))
      // 2. wa_conversaciones.select (releer la conversación) → sin fila
      .mockReturnValueOnce(supaResult({ data: null }));
    vi.mocked(createAdminClient).mockReturnValue(adminCon(from));

    await registrarMensaje({
      tenantId: "t-1",
      telefono: "5512345678",
      direccion: "saliente",
      tipo: "template",
      contenido: "hola",
      miembroId: "m-1",
    });

    expect(logError).toHaveBeenCalledWith(
      "wa.registrar_mensaje_upsert_fallo",
      expect.objectContaining({ tenantId: "t-1", error: "boom" })
    );
  });

  it("falla el insert en wa_mensajes → logError (el mensaje nunca aparece en el inbox)", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ error: null })) // upsert ok
      .mockReturnValueOnce(supaResult({ data: { id: "conv-1", no_leidos: 0, miembro_id: null, nombre_contacto: null } }))
      .mockReturnValueOnce(supaResult({ error: null })) // update conversación ok
      .mockReturnValueOnce(supaResult({ error: ERROR })); // insert mensaje → falla
    vi.mocked(createAdminClient).mockReturnValue(adminCon(from));

    await registrarMensaje({
      tenantId: "t-1",
      telefono: "5512345678",
      direccion: "saliente",
      tipo: "template",
      contenido: "hola",
      miembroId: "m-1",
    });

    expect(logError).toHaveBeenCalledWith(
      "wa.registrar_mensaje_insert_fallo",
      expect.objectContaining({ tenantId: "t-1", conversacionId: "conv-1", direccion: "saliente" })
    );
  });

  it("las tres escrituras funcionan → sin logError", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ data: { id: "conv-1", no_leidos: 0, miembro_id: null, nombre_contacto: null } }))
      .mockReturnValueOnce(supaResult({ error: null }))
      .mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createAdminClient).mockReturnValue(adminCon(from));

    await registrarMensaje({
      tenantId: "t-1",
      telefono: "5512345678",
      direccion: "saliente",
      tipo: "template",
      contenido: "hola",
      miembroId: "m-1",
    });

    expect(logError).not.toHaveBeenCalled();
  });
});

describe("registrarMensaje: destinatario 'dueno' (Bloque 10 sueltos — avisos al dueño, sql/070)", () => {
  it("no toca wa_conversaciones: un solo insert directo en wa_mensajes", async () => {
    const from = vi.fn().mockReturnValueOnce(supaResult({ error: null }));
    vi.mocked(createAdminClient).mockReturnValue(adminCon(from));

    await registrarMensaje({
      tenantId: "t-1",
      telefono: "5512345678",
      direccion: "saliente",
      tipo: "template",
      contenido: "Resumen diario enviado.",
      destinatario: "dueno",
      nombrePlantilla: "resumen_diario_owner",
      categoria: "utility",
    });

    // Un solo from(): el insert en wa_mensajes. Si tocara wa_conversaciones
    // (upsert + select + update) serían 4 llamadas, como en el camino
    // 'socio' de arriba.
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("wa_mensajes");
    expect(logError).not.toHaveBeenCalled();
  });

  it("insert falla → logError, sin excepción (fire-and-forget)", async () => {
    const from = vi.fn().mockReturnValueOnce(supaResult({ error: ERROR }));
    vi.mocked(createAdminClient).mockReturnValue(adminCon(from));

    await registrarMensaje({
      tenantId: "t-1",
      telefono: "5512345678",
      direccion: "saliente",
      tipo: "template",
      contenido: "Nuevo prospecto: Ana",
      destinatario: "dueno",
    });

    expect(logError).toHaveBeenCalledWith(
      "wa.registrar_mensaje_insert_fallo",
      expect.objectContaining({ tenantId: "t-1", destinatario: "dueno", error: "boom" })
    );
  });
});
