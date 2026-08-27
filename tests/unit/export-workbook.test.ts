import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildAnalysisWorkbook, type ExportAnalysis } from "@/features/analysis/export-workbook";

const analysis: ExportAnalysis = {
  code: "M6Q5-0001-2026", eventDate: new Date("2026-08-26T00:00:00.000Z"), process: "Calidad",
  firstName: "Ana", lastName: "Gómez", email: "ana@example.org", finding: "Hallazgo crítico", status: "EN_ANALISIS", rootCause: "Control insuficiente",
  categories: [{ category: "METODO", valuation: 6, subcauses: [{ description: "Procedimiento ambiguo", impact: 3 }] }],
  mainCauses: [{ position: 1, cause: "Falla de control", subcause: "Procedimiento ambiguo", why1: "Respuesta 1", why2: "Respuesta 2", why3: "Respuesta 3", why4: "Respuesta 4", why5: "Respuesta 5" }],
};

describe("analysis Excel export", () => {
  it("contains subcauses, valuation, causes, five whys and root cause", async () => {
    const buffer = await buildAnalysisWorkbook([analysis]).xlsx.writeBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Análisis M6Q5");
    expect(sheet).toBeDefined();
    const headers = (sheet?.getRow(1).values as Array<string | undefined>);
    const valueFor = (header: string) => sheet?.getRow(2).getCell(headers.indexOf(header)).value;

    expect(String(valueFor("Subcausas — Método"))).toContain("Método: Procedimiento ambiguo — Impacto 3 (Alto)");
    expect(valueFor("Valoración — Método")).toBe(6);
    expect(valueFor("Causa principal 1")).toBe("Falla de control");
    expect(valueFor("Subcausa asociada 1")).toBe("Procedimiento ambiguo");
    for (let why = 1; why <= 5; why += 1) expect(valueFor(`Por qué ${why} — causa 1`)).toBe(`Respuesta ${why}`);
    expect(valueFor("Causa raíz")).toBe("Control insuficiente");
  });
});
