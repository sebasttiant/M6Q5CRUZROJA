import { describe, expect, it } from "vitest";
import { buildAnalysisPdf, type PdfAnalysis } from "@/features/analysis/export-pdf";

const analysis: PdfAnalysis = {
  code: "M6Q5-0001-2026",
  eventDate: new Date("2026-08-26T00:00:00.000Z"),
  createdAt: new Date("2026-08-26T00:00:00.000Z"),
  process: "Gestión del riesgo",
  firstName: "Ana",
  lastName: "Gómez",
  email: "ana@example.org",
  finding: "La revisión del alistamiento evidenció una verificación incompleta de elementos críticos.",
  status: "EN_ANALISIS",
  rootCause: "El procedimiento no define un punto de control verificable antes de la salida operativa.",
  categories: [
    { category: "METODO", valuation: 6, subcauses: [{ description: "Control previo ambiguo", impact: 3 }, { description: "Responsable no asignado", impact: 2 }] },
    { category: "MEDICION", valuation: 3, subcauses: [{ description: "Lista de chequeo sin indicador", impact: 3 }] },
  ],
  mainCauses: [
    { position: 1, cause: "Método", subcause: "Control previo ambiguo", why1: "No se revisaron todos los elementos", why2: "La lista no exigía confirmación individual", why3: "El procedimiento agrupaba controles distintos" },
    { position: 2, cause: "Medición", subcause: "Lista de chequeo sin indicador", why1: "No hay indicador definido", why2: "Nadie mide el cumplimiento", why3: "El proceso no tiene dueño formal" },
  ],
};

/** Page objects are not compressed, so they can be counted straight from the raw bytes. */
const countPages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe("buildAnalysisPdf", () => {
  it("produces a valid PDF document", async () => {
    const pdf = await buildAnalysisPdf(analysis);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-6).toString()).toContain("%%EOF");
    expect(pdf.byteLength).toBeGreaterThan(2000);
  });

  it("keeps the institutional code in the document metadata", async () => {
    const pdf = await buildAnalysisPdf(analysis);
    // PDF string objects in the Info dictionary are stored as UTF-16BE.
    expect(pdf.includes(Buffer.from(analysis.code, "utf16le").swap16())).toBe(true);
  });

  it("survives an analysis with no main causes and no subcauses", async () => {
    const bare = { ...analysis, mainCauses: [], categories: [{ category: "METODO", valuation: 0, subcauses: [] }] };
    const pdf = await buildAnalysisPdf(bare);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("does not fail when the logo cannot be decoded", async () => {
    const pdf = await buildAnalysisPdf(analysis, Buffer.from("no soy una imagen"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("keeps a short analysis compact instead of exploding into pages", async () => {
    expect(countPages(await buildAnalysisPdf(analysis))).toBeLessThanOrEqual(3);
  });

  it("paginates long content instead of overflowing a single page", async () => {
    const long = "Detalle extenso del análisis institucional. ".repeat(120);
    const heavy: PdfAnalysis = {
      ...analysis,
      finding: long,
      rootCause: long,
      mainCauses: analysis.mainCauses.map((cause) => ({ ...cause, why1: long, why2: long, why3: long })),
    };
    const pages = countPages(await buildAnalysisPdf(heavy));
    expect(pages).toBeGreaterThan(countPages(await buildAnalysisPdf(analysis)));
    // A guard against the header/footer painter recursing into endless pages.
    expect(pages).toBeLessThan(20);
  });
});
