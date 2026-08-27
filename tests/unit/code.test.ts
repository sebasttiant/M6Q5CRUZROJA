import { describe, expect, it } from "vitest";
import { formatAnalysisCode } from "@/features/analysis/code";

describe("formatAnalysisCode", () => {
  it("formats the annual four-digit sequence", () => expect(formatAnalysisCode(1, 2026)).toBe("M6Q5-0001-2026"));
  it("rejects values outside the four-digit range", () => expect(() => formatAnalysisCode(10000, 2026)).toThrow());
});
