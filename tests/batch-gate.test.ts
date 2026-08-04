import { describe, expect, it } from "vitest";
import { tightenScrollCeiling } from "../lib/batch-gate-ui";

describe("batch gate scroll ceiling", () => {
  it("captures the gate position as an absolute scroll ceiling", () => {
    expect(tightenScrollCeiling(undefined, 1800, 2279)).toBe(4063);
  });

  it("does not move the ceiling down when a virtualized gate jumps", () => {
    expect(tightenScrollCeiling(4063, 2500, 1777)).toBe(4063);
    expect(tightenScrollCeiling(4063, 2500, 900)).toBe(3384);
  });
});
