import { describe, expect, it } from "vitest";
import { matchesExactToken } from "../lib/surface-suppression";

describe("surface suppression", () => {
  it("matches only exact localized navigation labels", () => {
    expect(matchesExactToken(" Shorts ", ["shorts"])).toBe(true);
    expect(matchesExactToken("Inicio", ["home", "inicio"])).toBe(true);
    expect(matchesExactToken("Shorts recomendados", ["shorts"])).toBe(false);
    expect(matchesExactToken("Página de inicio", ["home", "inicio"])).toBe(
      false,
    );
  });
});
