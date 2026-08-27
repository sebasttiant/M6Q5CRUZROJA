import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/features/analysis/constants";
import { analysisSchema } from "@/features/analysis/schema";

const cause = { cause: "Falla", subcause: "Control", why1: "1", why2: "2", why3: "3", why4: "4", why5: "5" };
const valid = { firstName: "Ana", lastName: "Gómez", email: "ana@example.org", process: "Socorro", eventDate: "2026-08-26", finding: "Hallazgo", status: "EN_ANALISIS", categories: CATEGORIES.map(({ key }) => ({ category: key, subcauses: [] })), mainCauses: [cause], rootCause: "Control insuficiente" };

describe("analysisSchema", () => {
  it("accepts a complete analysis", () => expect(analysisSchema.safeParse(valid).success).toBe(true));
  it("requires all five whys", () => expect(analysisSchema.safeParse({ ...valid, mainCauses: [{ ...cause, why5: "" }] }).success).toBe(false));
  it("rejects more than two main causes", () => expect(analysisSchema.safeParse({ ...valid, mainCauses: [cause, cause, cause] }).success).toBe(false));
  it("rejects duplicate 6M categories", () => expect(analysisSchema.safeParse({ ...valid, categories: valid.categories.map((item) => ({ ...item, category: "METODO" })) }).success).toBe(false));
});
