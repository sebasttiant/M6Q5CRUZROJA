import ExcelJS from "exceljs";
import { CATEGORIES, STATUS_LABELS, WHY_FIELDS } from "./constants";

const WHY_NUMBERS = WHY_FIELDS.map((_field, index) => index + 1);

interface ExportSubcause {
  description: string;
  impact: number;
}

interface ExportCategory {
  category: string;
  valuation: number;
  subcauses: ExportSubcause[];
}

interface ExportMainCause {
  position: number;
  cause: string;
  subcause: string;
  why1: string;
  why2: string;
  why3: string;
}

export interface ExportAnalysis {
  code: string;
  eventDate: Date;
  process: string;
  firstName: string;
  lastName: string;
  email: string;
  finding: string;
  status: string;
  rootCause: string;
  categories: ExportCategory[];
  mainCauses: ExportMainCause[];
}

const IMPACT_LABELS: Record<number, string> = { 1: "Bajo", 2: "Medio", 3: "Alto" };

export function buildAnalysisWorkbook(analyses: ExportAnalysis[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cruz Roja Colombiana Seccional Antioquia";
  const sheet = workbook.addWorksheet("Análisis M6Q5", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Código", key: "code", width: 20 }, { header: "Fecha", key: "date", width: 13 }, { header: "Proceso", key: "process", width: 25 },
    { header: "Nombre", key: "name", width: 25 }, { header: "Correo", key: "email", width: 30 }, { header: "Hallazgo", key: "finding", width: 55 },
    { header: "Estado", key: "status", width: 20 },
    ...CATEGORIES.flatMap(({ key, label }) => [
      { header: `Subcausas — ${label}`, key: `${key}_subcauses`, width: 50 },
      { header: `Valoración — ${label}`, key: `${key}_valuation`, width: 22 },
    ]),
    ...[1, 2].flatMap((position) => [
      { header: `Causa principal ${position}`, key: `cause${position}`, width: 40 },
      { header: `Subcausa asociada ${position}`, key: `associatedSubcause${position}`, width: 40 },
      ...WHY_NUMBERS.map((why) => ({ header: `Por qué ${why} — causa ${position}`, key: `cause${position}Why${why}`, width: 42 })),
    ]),
    { header: "Causa raíz", key: "rootCause", width: 55 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCC0000" } };
  header.alignment = { vertical: "middle", wrapText: true };
  sheet.autoFilter = { from: "A1", to: { row: 1, column: sheet.columnCount } };

  for (const analysis of analyses) {
    const categoryValues = Object.fromEntries(analysis.categories.flatMap((category) => {
      const metadata = CATEGORIES.find(({ key }) => key === category.category);
      const label = metadata?.label ?? category.category;
      const subcauses = category.subcauses.map((subcause, index) => `${index + 1}. ${label}: ${subcause.description} — Impacto ${subcause.impact} (${IMPACT_LABELS[subcause.impact] ?? "Sin clasificar"})`).join("\n");
      return [[`${category.category}_subcauses`, subcauses], [`${category.category}_valuation`, category.valuation]];
    }));
    const causeValues = Object.fromEntries(analysis.mainCauses.flatMap((cause) => [
      [`cause${cause.position}`, cause.cause],
      [`associatedSubcause${cause.position}`, cause.subcause],
      ...[cause.why1, cause.why2, cause.why3].map((why, index) => [`cause${cause.position}Why${index + 1}`, why]),
    ]));
    sheet.addRow({
      code: analysis.code, date: analysis.eventDate.toISOString().slice(0, 10), process: analysis.process,
      name: `${analysis.firstName} ${analysis.lastName}`, email: analysis.email, finding: analysis.finding,
      status: STATUS_LABELS[analysis.status] ?? analysis.status, ...categoryValues, ...causeValues, rootCause: analysis.rootCause,
    });
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
  });
  return workbook;
}
