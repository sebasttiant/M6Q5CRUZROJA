import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/features/analysis/constants";
import { calculateValuation, rankMainCauseCandidates } from "@/features/analysis/valuation";

/**
 * Truth table of the source spreadsheet formula in AC-43!G30, where F30..F32 are the three
 * impact cells of a single 6M block:
 *
 * =IF(AND(F30<>"",F31<>"",F32<>""),F30*F31*F32,
 *  IF(AND(F30<>"",F31<>"",F32=""),F30*F31,
 *  IF(AND(F30<>"",F31="",F32<>""),F30*F32,
 *  IF(AND(F30<>"",F31="",F32=""),F30,
 *  IF(AND(F30="",F31<>"",F32<>""),F31*F32,
 *  IF(AND(F30="",F31<>"",F32=""),F31,
 *  IF(AND(F30="",F31="",F32<>""),F32,0)))))))
 */
const SPREADSHEET_BRANCHES: Array<{ branch: string; impacts: Array<number | null>; expected: number }> = [
  { branch: "F30,F31,F32 filled -> F30*F31*F32", impacts: [3, 2, 2], expected: 12 },
  { branch: "F30,F31 filled -> F30*F31", impacts: [3, 2, null], expected: 6 },
  { branch: "F30,F32 filled -> F30*F32", impacts: [3, null, 2], expected: 6 },
  { branch: "F30 filled -> F30", impacts: [3, null, null], expected: 3 },
  { branch: "F31,F32 filled -> F31*F32", impacts: [null, 3, 2], expected: 6 },
  { branch: "F31 filled -> F31", impacts: [null, 3, null], expected: 3 },
  { branch: "F32 filled -> F32", impacts: [null, null, 3], expected: 3 },
  { branch: "none filled -> 0", impacts: [null, null, null], expected: 0 },
];

describe("calculateValuation", () => {
  it.each(SPREADSHEET_BRANCHES)("matches the spreadsheet branch: $branch", ({ impacts, expected }) => {
    expect(calculateValuation(impacts)).toBe(expected);
  });

  it("ignores undefined the same way the spreadsheet ignores empty cells", () => {
    expect(calculateValuation([undefined, 2, undefined])).toBe(2);
  });

  it("returns zero for an empty block", () => expect(calculateValuation([])).toBe(0));
});

const subcause = (description: string, impact: number | null) => ({ description, impact });

describe("rankMainCauseCandidates", () => {
  const categories = [
    { category: "MANO_DE_OBRA" as const, subcauses: [subcause("Inducción no verificada", 2)] },
    { category: "MEDICION" as const, subcauses: [subcause("Lista sin indicador", 3)] },
    { category: "METODO" as const, subcauses: [subcause("Control previo ambiguo", 3), subcause("Responsable no asignado", 2)] },
    { category: "MATERIALES" as const, subcauses: [] },
    { category: "MAQUINARIA_EQUIPOS" as const, subcauses: [subcause("Sin descripción", null)] },
    { category: "MEDIO_AMBIENTE" as const, subcauses: [subcause("Presión por tiempo", 1)] },
  ];

  it("carries the two highest valuations, highest first", () => {
    expect(rankMainCauseCandidates(categories).map((item) => [item.category, item.valuation])).toEqual([
      ["METODO", 6],
      ["MEDICION", 3],
    ]);
  });

  it("suggests the highest impact subcause of each selected category", () => {
    expect(rankMainCauseCandidates(categories).map((item) => item.subcause)).toEqual([
      "Control previo ambiguo",
      "Lista sin indicador",
    ]);
  });

  it("never returns more than two candidates", () => {
    expect(rankMainCauseCandidates(categories)).toHaveLength(2);
  });

  it("excludes categories whose valuation is zero", () => {
    const onlyOneScored = categories.map((item) => (item.category === "METODO" ? item : { ...item, subcauses: [] }));
    expect(rankMainCauseCandidates(onlyOneScored).map((item) => item.category)).toEqual(["METODO"]);
  });

  it("breaks ties using the canonical 6M order of the format", () => {
    const tied = CATEGORIES.map(({ key }) => ({ category: key, subcauses: [subcause(`Subcausa ${key}`, 3)] }));
    expect(rankMainCauseCandidates(tied).map((item) => item.category)).toEqual(["MANO_DE_OBRA", "MEDICION"]);
  });

  it("returns nothing while no impact has been assessed", () => {
    expect(rankMainCauseCandidates(CATEGORIES.map(({ key }) => ({ category: key, subcauses: [] })))).toEqual([]);
  });
});
