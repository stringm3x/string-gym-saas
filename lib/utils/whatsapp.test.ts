import { describe, it, expect } from "vitest";
import { normalizarTelefonoMx, buildWhatsAppUrl } from "./whatsapp";

describe("normalizarTelefonoMx", () => {
  it("10 dígitos limpios → antepone 52", () => {
    expect(normalizarTelefonoMx("5512345678")).toBe("525512345678");
  });

  it("10 dígitos con espacios, guiones y paréntesis → limpia y antepone 52", () => {
    expect(normalizarTelefonoMx("55 1234 5678")).toBe("525512345678");
    expect(normalizarTelefonoMx("55-1234-5678")).toBe("525512345678");
    expect(normalizarTelefonoMx("(55) 1234-5678")).toBe("525512345678");
  });

  it("ya trae lada 52 (12 dígitos) → no la duplica", () => {
    expect(normalizarTelefonoMx("525512345678")).toBe("525512345678");
  });

  it("con '+52' → limpia el '+' y no duplica la lada", () => {
    expect(normalizarTelefonoMx("+52 55 1234 5678")).toBe("525512345678");
  });

  it("convención vieja 521 (13 dígitos) → quita el 1 redundante", () => {
    expect(normalizarTelefonoMx("5215512345678")).toBe("525512345678");
  });

  it("largo no reconocido → se deja tal cual, sin inventar lada", () => {
    expect(normalizarTelefonoMx("12345")).toBe("12345");
    expect(normalizarTelefonoMx("")).toBe("");
  });
});

describe("buildWhatsAppUrl", () => {
  it("arma la URL con el teléfono normalizado y el mensaje codificado", () => {
    expect(buildWhatsAppUrl("5512345678", "Hola ¿qué tal?")).toBe(
      "https://wa.me/525512345678?text=Hola%20%C2%BFqu%C3%A9%20tal%3F"
    );
  });
});
