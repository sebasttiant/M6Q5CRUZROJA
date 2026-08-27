import { describe, expect, it } from "vitest";
import { CATEGORIES, MAX_SUBCAUSES_PER_CATEGORY } from "@/features/analysis/constants";
import { analysisSchema } from "@/features/analysis/schema";

const cause = { cause: "Método", subcause: "Control previo ambiguo", why1: "1", why2: "2", why3: "3" };
const valid = { firstName: "Ana", lastName: "Gómez", email: "ana@example.org", process: "Socorro", eventDate: "2026-08-26", finding: "Hallazgo", status: "EN_ANALISIS", categories: CATEGORIES.map(({ key }) => ({ category: key, subcauses: [] })), mainCauses: [cause], rootCause: "Control insuficiente" };

const subcauses = (count: number) => Array.from({ length: count }, (_, index) => ({ description: `Subcausa ${index + 1}`, impact: 2 }));
const withSubcauses = (count: number) => ({
  ...valid,
  categories: valid.categories.map((item, index) => (index === 0 ? { ...item, subcauses: subcauses(count) } : item)),
});

describe("analysisSchema", () => {
  it("accepts a complete analysis", () => expect(analysisSchema.safeParse(valid).success).toBe(true));
  it("requires all three whys", () => expect(analysisSchema.safeParse({ ...valid, mainCauses: [{ ...cause, why3: "" }] }).success).toBe(false));
  it("rejects more than two main causes", () => expect(analysisSchema.safeParse({ ...valid, mainCauses: [cause, cause, cause] }).success).toBe(false));
  it("rejects duplicate 6M categories", () => expect(analysisSchema.safeParse({ ...valid, categories: valid.categories.map((item) => ({ ...item, category: "METODO" })) }).success).toBe(false));

  it(`accepts ${MAX_SUBCAUSES_PER_CATEGORY} subcauses in a category`, () => {
    expect(analysisSchema.safeParse(withSubcauses(MAX_SUBCAUSES_PER_CATEGORY)).success).toBe(true);
  });

  it(`rejects more than ${MAX_SUBCAUSES_PER_CATEGORY} subcauses in a category`, () => {
    expect(analysisSchema.safeParse(withSubcauses(MAX_SUBCAUSES_PER_CATEGORY + 1)).success).toBe(false);
  });
});
