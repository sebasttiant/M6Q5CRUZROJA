import { describe, expect, it } from "vitest";
import { calculateValuation } from "@/features/analysis/valuation";

describe("calculateValuation", () => {
  it("returns zero without completed impacts", () => expect(calculateValuation([])).toBe(0));
  it("multiplies only completed impacts like the source spreadsheet", () => expect(calculateValuation([3, null, 2])).toBe(6));
  it("supports one completed impact", () => expect(calculateValuation([undefined, 2])).toBe(2));
});
