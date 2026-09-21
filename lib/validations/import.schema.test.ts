/**
 * Bloque 09: el CSV solo aceptaba AAAA-MM-DD y rechazaba la fila entera con
 * cualquier otro formato — Excel en español exporta DD/MM/AAAA por default,
 * así que una importación real con fechas de Excel perdía filas completas
 * sin que fuera obvio por qué. No se puede probar a mano sin un CSV real.
 */
import { describe, it, expect } from "vitest";
import { csvRowSchema } from "./import.schema";

const BASE = { nombre: "Ana", telefono: "5512345678" };

describe("csvRowSchema: fechas — AAAA-MM-DD y DD/MM/AAAA (bloque 09)", () => {
  it("AAAA-MM-DD sigue funcionando igual que antes", () => {
    const r = csvRowSchema.safeParse({
      ...BASE,
      fecha_vencimiento: "2026-08-01",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fecha_vencimiento).toBe("2026-08-01");
  });

  it("DD/MM/AAAA (Excel en español) se normaliza a AAAA-MM-DD", () => {
    const r = csvRowSchema.safeParse({
      ...BASE,
      fecha_vencimiento: "15/08/2026",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fecha_vencimiento).toBe("2026-08-15");
  });

  it("día que solo tiene sentido como día (13) en DD/MM/AAAA se interpreta día-primero, no mes", () => {
    const r = csvRowSchema.safeParse({
      ...BASE,
      fecha_vencimiento: "13/02/2026",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fecha_vencimiento).toBe("2026-02-13");
  });

  it("vacío sigue siendo válido (fecha opcional)", () => {
    const r = csvRowSchema.safeParse({ ...BASE, fecha_vencimiento: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fecha_vencimiento).toBe("");
  });

  it("formato irreconocible → rechaza la fila con el mensaje que menciona ambos formatos válidos", () => {
    const r = csvRowSchema.safeParse({
      ...BASE,
      fecha_vencimiento: "01-agosto-2026",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("AAAA-MM-DD");
      expect(r.error.issues[0].message).toContain("DD/MM/AAAA");
    }
  });

  it("aplica igual a fecha_inscripcion, no solo a fecha_vencimiento", () => {
    const r = csvRowSchema.safeParse({
      ...BASE,
      fecha_inscripcion: "01/03/2026",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fecha_inscripcion).toBe("2026-03-01");
  });
});
