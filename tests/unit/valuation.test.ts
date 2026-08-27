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

  it("breaks ties using the institutional M1..M6 order", () => {
    const tied = CATEGORIES.map(({ key }) => ({ category: key, subcauses: [subcause(`Subcausa ${key}`, 3)] }));
    // M1 Mano de obra and M2 Método win over the four categories that follow them.
    expect(rankMainCauseCandidates(tied).map((item) => item.category)).toEqual(["MANO_DE_OBRA", "METODO"]);
  });

  it("returns nothing while no impact has been assessed", () => {
    expect(rankMainCauseCandidates(CATEGORIES.map(({ key }) => ({ category: key, subcauses: [] })))).toEqual([]);
  });
});

/**
 * Literal transcription of AC-43!G30. Cells hold "" when blank and the list validation on
 * F30:F32 only offers 1, 2 and 3, so this covers every state the format can reach.
 */
function spreadsheetG30(f30: number | "", f31: number | "", f32: number | ""): number {
  if (f30 !== "" && f31 !== "" && f32 !== "") return f30 * f31 * f32;
  if (f30 !== "" && f31 !== "" && f32 === "") return f30 * f31;
  if (f30 !== "" && f31 === "" && f32 !== "") return f30 * f32;
  if (f30 !== "" && f31 === "" && f32 === "") return f30;
  if (f30 === "" && f31 !== "" && f32 !== "") return f31 * f32;
  if (f30 === "" && f31 !== "" && f32 === "") return f31;
  if (f30 === "" && f31 === "" && f32 !== "") return f32;
  return 0;
}

const CELL_STATES: Array<number | ""> = ["", 1, 2, 3];

describe("calculateValuation against every reachable state of AC-43!G30", () => {
  const combinations = CELL_STATES.flatMap((f30) =>
    CELL_STATES.flatMap((f31) => CELL_STATES.map((f32) => [f30, f31, f32] as const)),
  );

  it("covers all 64 combinations the three impact cells can hold", () => {
    expect(combinations).toHaveLength(64);
  });

  it.each(combinations)("F30=%s F31=%s F32=%s", (f30, f31, f32) => {
    const asImpacts = [f30, f31, f32].map((cell) => (cell === "" ? null : cell));
    expect(calculateValuation(asImpacts)).toBe(spreadsheetG30(f30, f31, f32));
  });
});
