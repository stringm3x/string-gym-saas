import { describe, it, expect } from "vitest";
import {
  tipoOperacionMembresia,
  calcularRangoPorDias,
} from "./membresia-rango";

const hoy = new Date("2026-06-15T12:00:00");

describe("tipoOperacionMembresia", () => {
  it("sin vencimiento → nuevo", () => {
    expect(tipoOperacionMembresia(null, hoy)).toBe("nuevo");
  });

  it("vigente (vence en el futuro) → renovacion", () => {
    expect(tipoOperacionMembresia("2026-07-01", hoy)).toBe("renovacion");
  });

  it("vence hoy → renovacion", () => {
    expect(tipoOperacionMembresia("2026-06-15", hoy)).toBe("renovacion");
  });

  it("vencido 10 días (<=30) → renovacion tardía", () => {
    expect(tipoOperacionMembresia("2026-06-05", hoy)).toBe("renovacion");
  });

  it("vencido exactamente 30 días → renovacion (borde)", () => {
    expect(tipoOperacionMembresia("2026-05-16", hoy)).toBe("renovacion");
  });

  it("vencido 31 días (>30) → reactivacion", () => {
    expect(tipoOperacionMembresia("2026-05-15", hoy)).toBe("reactivacion");
  });
});

describe("calcularRangoPorDias (D1 — suma de días)", () => {
  it("nuevo miembro → desde hoy", () => {
    const r = calcularRangoPorDias(30, null, hoy);
    expect(r.tipo).toBe("nuevo");
    expect(r.periodo_inicio).toBe("2026-06-15");
    expect(r.periodo_fin).toBe("2026-07-14"); // hoy + 30 - 1
  });

  it("renovación normal (activo) → ancla al vencimiento original", () => {
    const r = calcularRangoPorDias(30, "2026-07-01", hoy);
    expect(r.tipo).toBe("renovacion");
    expect(r.periodo_inicio).toBe("2026-07-02"); // venc + 1
    expect(r.periodo_fin).toBe("2026-07-31"); // venc + 30
  });

  it("renovación tardía (vencido 10 días) → ancla al original, no a hoy", () => {
    const r = calcularRangoPorDias(30, "2026-06-05", hoy);
    expect(r.tipo).toBe("renovacion");
    expect(r.periodo_inicio).toBe("2026-06-06");
    expect(r.periodo_fin).toBe("2026-07-05"); // pierde los días tarde
  });

  it("reactivación (vencido 40 días) → resetea a hoy", () => {
    const r = calcularRangoPorDias(30, "2026-05-06", hoy);
    expect(r.tipo).toBe("reactivacion");
    expect(r.periodo_inicio).toBe("2026-06-15");
    expect(r.periodo_fin).toBe("2026-07-14");
  });

  it("periodos consecutivos son contiguos (sin días perdidos en renovación)", () => {
    const r = calcularRangoPorDias(30, "2026-07-01", hoy);
    // El día siguiente al vencimiento original es el inicio del nuevo periodo.
    expect(r.periodo_inicio).toBe("2026-07-02");
  });

  it("edge fin de mes: venc 31-ene + 30 días (suma de días, el día corre)", () => {
    const r = calcularRangoPorDias(30, "2026-01-31", new Date("2026-01-20T12:00:00"));
    expect(r.tipo).toBe("renovacion"); // aún vigente al 20-ene
    expect(r.periodo_inicio).toBe("2026-02-01");
    expect(r.periodo_fin).toBe("2026-03-02"); // 31-ene + 30 días
  });
});
