import { describe, expect, it } from "vitest";
import { numeroARS, textoSeguro } from "./chat";

describe("normalización defensiva de datos del chat", () => {
  it("no convierte objetos inesperados en texto", () => {
    expect(textoSeguro({ error: "x" }, "Respuesta inválida")).toBe("Respuesta inválida");
    expect(textoSeguro(null, "")).toBe("");
    expect(textoSeguro("Listo")).toBe("Listo");
  });
  it("formatea importes finitos y rechaza valores inválidos", () => {
    expect(numeroARS(1250)).toContain("1.250");
    expect(numeroARS(null)).toBe("A confirmar");
    expect(numeroARS(Number.NaN)).toBe("A confirmar");
  });
});