import PDFDocument from "pdfkit";
import { CATEGORIES, STATUS_LABELS, WHY_FIELDS } from "./constants";

interface PdfSubcause {
  description: string;
  impact: number;
}

interface PdfCategory {
  category: string;
  valuation: number;
  subcauses: PdfSubcause[];
}

interface PdfMainCause {
  position: number;
  cause: string;
  subcause: string;
  why1: string;
  why2: string;
  why3: string;
}

export interface PdfAnalysis {
  code: string;
  eventDate: Date;
  createdAt: Date;
  process: string;
  firstName: string;
  lastName: string;
  email: string;
  finding: string;
  status: string;
  rootCause: string;
  categories: PdfCategory[];
  mainCauses: PdfMainCause[];
}

const BRAND = "#CC0000";
const INK = "#1D1D1B";
const MUTED = "#6B6B68";
const BORDER = "#E0DDD9";
const SOFT = "#F7F6F4";

const MARGIN = 46;
const PAGE_WIDTH = 595.28; // A4 portrait
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** First baseline available below the header band. */
const BODY_TOP = 78;

const IMPACT_LABELS: Record<number, string> = { 1: "Bajo", 2: "Medio", 3: "Alto" };

const formatDate = (value: Date) => value.toLocaleDateString("es-CO", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

type Doc = PDFKit.PDFDocument;

/** Reserves vertical space, breaking the page first when the block would not fit. */
function reserve(doc: Doc, height: number): void {
  if (doc.y + height > doc.page.height - MARGIN - 26) doc.addPage();
}

function sectionTitle(doc: Doc, index: string, title: string): void {
  reserve(doc, 46);
  const top = doc.y;
  doc.roundedRect(MARGIN, top, 22, 22, 5).fill(BRAND);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text(index, MARGIN, top + 7, { width: 22, align: "center" });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(title, MARGIN + 32, top + 5);
  doc.y = top + 32;
}

/** Two-column key/value grid used by the identification block. */
function fieldGrid(doc: Doc, entries: Array<[string, string]>): void {
  const columnWidth = (CONTENT_WIDTH - 12) / 2;
  for (let index = 0; index < entries.length; index += 2) {
    const pair = entries.slice(index, index + 2);
    const heights = pair.map(([, value]) => doc.font("Helvetica-Bold").fontSize(9.5).heightOfString(value || "—", { width: columnWidth - 20 }));
    const rowHeight = Math.max(...heights) + 26;
    reserve(doc, rowHeight);
    const top = doc.y;
    pair.forEach(([label, value], column) => {
      const left = MARGIN + column * (columnWidth + 12);
      doc.roundedRect(left, top, columnWidth, rowHeight - 6, 6).fillAndStroke(SOFT, BORDER);
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(6.6).text(label.toUpperCase(), left + 10, top + 8, { width: columnWidth - 20, characterSpacing: 0.6 });
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(value || "—", left + 10, top + 19, { width: columnWidth - 20 });
    });
    doc.y = top + rowHeight;
  }
}

function paragraphBlock(doc: Doc, text: string): void {
  const height = doc.font("Helvetica").fontSize(10).heightOfString(text, { width: CONTENT_WIDTH - 20, lineGap: 2 }) + 20;
  reserve(doc, height);
  const top = doc.y;
  doc.roundedRect(MARGIN, top, CONTENT_WIDTH, height - 4, 6).fillAndStroke("#FFFFFF", BORDER);
  doc.fillColor(INK).font("Helvetica").fontSize(10).text(text, MARGIN + 10, top + 9, { width: CONTENT_WIDTH - 20, lineGap: 2 });
  doc.y = top + height;
}

/** One row per 6M category with its subcauses, impacts and the valuation of the block. */
function categoryTable(doc: Doc, categories: PdfCategory[]): void {
  const columns = [CONTENT_WIDTH * 0.26, CONTENT_WIDTH * 0.56, CONTENT_WIDTH * 0.18];

  const header = () => {
    const top = doc.y;
    doc.rect(MARGIN, top, CONTENT_WIDTH, 20).fill(BRAND);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7.6);
    doc.text("CATEGORÍA 6M", MARGIN + 8, top + 6.5, { width: columns[0] - 12 });
    doc.text("SUBCAUSAS E IMPACTO", MARGIN + columns[0] + 8, top + 6.5, { width: columns[1] - 12 });
    doc.text("VALORACIÓN", MARGIN + columns[0] + columns[1], top + 6.5, { width: columns[2] - 8, align: "center" });
    doc.y = top + 20;
  };

  reserve(doc, 70);
  header();

  for (const { key, label } of CATEGORIES) {
    const category = categories.find((item) => item.category === key);
    const lines = (category?.subcauses ?? []).map((subcause, index) => `${index + 1}. ${subcause.description} — Impacto ${subcause.impact} (${IMPACT_LABELS[subcause.impact] ?? "Sin clasificar"})`);
    const body = lines.length ? lines.join("\n") : "Sin subcausas registradas.";
    const bodyHeight = doc.font("Helvetica").fontSize(8.6).heightOfString(body, { width: columns[1] - 16, lineGap: 1.5 });
    const rowHeight = Math.max(bodyHeight + 14, 26);

    if (doc.y + rowHeight > doc.page.height - MARGIN - 26) {
      doc.addPage();
      header();
    }

    const top = doc.y;
    doc.rect(MARGIN, top, CONTENT_WIDTH, rowHeight).fillAndStroke(SOFT, BORDER);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.8).text(label, MARGIN + 8, top + 7, { width: columns[0] - 12 });
    doc.fillColor(lines.length ? INK : MUTED).font("Helvetica").fontSize(8.6).text(body, MARGIN + columns[0] + 8, top + 7, { width: columns[1] - 16, lineGap: 1.5 });
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(12).text(String(category?.valuation ?? 0), MARGIN + columns[0] + columns[1], top + rowHeight / 2 - 7, { width: columns[2] - 8, align: "center" });
    doc.y = top + rowHeight;
  }

  doc.y += 6;
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(7.4).text("La valoración multiplica únicamente los impactos diligenciados de cada categoría; sin impactos es 0.", MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.y += 10;
}

function mainCauseBlock(doc: Doc, cause: PdfMainCause): void {
  const whys = WHY_FIELDS.map((field) => cause[field]);
  const whyHeights = whys.map((why) => doc.font("Helvetica").fontSize(8.8).heightOfString(why, { width: CONTENT_WIDTH - 46, lineGap: 1.5 }));
  const blockHeight = 52 + whyHeights.reduce((total, height) => total + height + 14, 0);
  reserve(doc, Math.min(blockHeight, 260));

  const top = doc.y;
  doc.roundedRect(MARGIN, top, CONTENT_WIDTH, 30, 6).fillAndStroke("#FFFFFF", BORDER);
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(9.5).text(`CAUSA PRINCIPAL ${cause.position}`, MARGIN + 10, top + 7, { width: CONTENT_WIDTH - 20 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(cause.cause, MARGIN + 10, top + 18, { width: CONTENT_WIDTH * 0.5 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(8.4).text(`Subcausa: ${cause.subcause}`, MARGIN + CONTENT_WIDTH * 0.5, top + 18, { width: CONTENT_WIDTH * 0.5 - 12, align: "right" });
  doc.y = top + 36;

  whys.forEach((why, index) => {
    const height = doc.font("Helvetica").fontSize(8.8).heightOfString(why, { width: CONTENT_WIDTH - 46, lineGap: 1.5 }) + 14;
    reserve(doc, height);
    const rowTop = doc.y;
    doc.roundedRect(MARGIN + 8, rowTop, CONTENT_WIDTH - 8, height - 4, 5).fillAndStroke(SOFT, BORDER);
    doc.circle(MARGIN + 22, rowTop + 12, 7).fill(INK);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7).text(String(index + 1), MARGIN + 15, rowTop + 9, { width: 14, align: "center" });
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(6.6).text(`POR QUÉ ${index + 1}`, MARGIN + 34, rowTop + 6);
    doc.fillColor(INK).font("Helvetica").fontSize(8.8).text(why, MARGIN + 34, rowTop + 15, { width: CONTENT_WIDTH - 46, lineGap: 1.5 });
    doc.y = rowTop + height;
  });

  doc.y += 6;
}

function rootCauseBlock(doc: Doc, rootCause: string): void {
  const height = doc.font("Helvetica-Bold").fontSize(11).heightOfString(rootCause, { width: CONTENT_WIDTH - 24, lineGap: 2 }) + 22;
  reserve(doc, height);
  const top = doc.y;
  doc.roundedRect(MARGIN, top, CONTENT_WIDTH, height - 4, 8).fill(BRAND);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11).text(rootCause, MARGIN + 12, top + 10, { width: CONTENT_WIDTH - 24, lineGap: 2 });
  doc.y = top + height;
}

function signatureBlock(doc: Doc): void {
  reserve(doc, 74);
  doc.y += 14;
  const top = doc.y;
  const columnWidth = (CONTENT_WIDTH - 24) / 2;
  ["Elaboró", "Revisó y aprobó"].forEach((label, column) => {
    const left = MARGIN + column * (columnWidth + 24);
    doc.moveTo(left, top + 30).lineTo(left + columnWidth, top + 30).lineWidth(0.8).stroke(BORDER);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), left, top + 36, { width: columnWidth, characterSpacing: 0.6 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(7).text("Nombre, cargo y fecha", left, top + 46, { width: columnWidth });
  });
  doc.y = top + 60;
}

/**
 * Runs a painter with the page margins neutralised. Header and footer sit outside the text
 * area, and pdfkit would otherwise read that as an overflow and add a page — which re-enters
 * the painter and recurses until the stack blows.
 */
function outsideTextArea(doc: Doc, paint: () => void): void {
  const margins = { ...doc.page.margins };
  const cursor = { x: doc.x, y: doc.y };
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    paint();
  } finally {
    doc.page.margins = margins;
    // Painting the footer leaves the cursor at the bottom of the sheet. Restoring it keeps the
    // body flowing from where it was instead of overflowing straight into another page.
    doc.x = cursor.x;
    doc.y = cursor.y;
  }
}

/** Header and footer are painted per page so every sheet is identifiable on its own. */
function decoratePage(doc: Doc, analysis: PdfAnalysis, logo: Buffer | null): void {
  outsideTextArea(doc, () => paintFrame(doc, analysis, logo));
}

function paintFrame(doc: Doc, analysis: PdfAnalysis, logo: Buffer | null): void {
  doc.rect(0, 0, PAGE_WIDTH, 4).fill(BRAND);
  if (logo) {
    try {
      doc.image(logo, MARGIN, 18, { fit: [116, 42] });
    } catch {
      // A broken asset must never stop the document from being produced.
    }
  }
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.5).text("Análisis de causa raíz", MARGIN + 130, 24, { width: CONTENT_WIDTH - 130 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.6).text("Cruz Roja Colombiana Seccional Antioquia · Metodología 6M + 5 porqués", MARGIN + 130, 38, { width: CONTENT_WIDTH - 130 });
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(10).text(analysis.code, MARGIN, 24, { width: CONTENT_WIDTH, align: "right" });
  doc.moveTo(MARGIN, 62).lineTo(PAGE_WIDTH - MARGIN, 62).lineWidth(0.8).stroke(BORDER);

  const footerTop = doc.page.height - MARGIN + 4;
  doc.moveTo(MARGIN, footerTop).lineTo(PAGE_WIDTH - MARGIN, footerTop).lineWidth(0.8).stroke(BORDER);
  doc.fillColor(MUTED).font("Helvetica").fontSize(7).text(`${analysis.code} · Generado el ${formatDate(new Date())}`, MARGIN, footerTop + 6, { width: CONTENT_WIDTH });
}

export function buildAnalysisPdf(analysis: PdfAnalysis, logo: Buffer | null = null): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 74, bottom: MARGIN + 20, left: MARGIN, right: MARGIN }, bufferPages: true, info: { Title: `${analysis.code} — Análisis de causa raíz`, Author: "Cruz Roja Colombiana Seccional Antioquia", Subject: analysis.finding } });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.on("pageAdded", () => {
    decoratePage(doc, analysis, logo);
    doc.x = MARGIN;
    doc.y = BODY_TOP;
  });
  decoratePage(doc, analysis, logo);
  doc.x = MARGIN;
  doc.y = BODY_TOP;

  sectionTitle(doc, "01", "Identificación del análisis");
  fieldGrid(doc, [
    ["Código", analysis.code],
    ["Estado", STATUS_LABELS[analysis.status] ?? analysis.status],
    ["Responsable", `${analysis.firstName} ${analysis.lastName}`],
    ["Correo", analysis.email],
    ["Proceso", analysis.process],
    ["Fecha del hallazgo", formatDate(analysis.eventDate)],
  ]);
  doc.y += 4;
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(6.6).text("HALLAZGO", MARGIN, doc.y, { characterSpacing: 0.6 });
  doc.y += 10;
  paragraphBlock(doc, analysis.finding);
  doc.y += 10;

  sectionTitle(doc, "02", "Identificación de causas — 6M");
  categoryTable(doc, analysis.categories);
  doc.y += 6;

  sectionTitle(doc, "03", "Causas principales y cinco porqués");
  if (analysis.mainCauses.length === 0) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("Sin causas principales registradas.", MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.y += 16;
  }
  for (const cause of analysis.mainCauses) mainCauseBlock(doc, cause);
  doc.y += 4;

  sectionTitle(doc, "04", "Causa raíz final");
  rootCauseBlock(doc, analysis.rootCause);
  signatureBlock(doc);

  // Page numbers need the full range, so they are stamped once the body is laid out.
  const range = doc.bufferedPageRange();
  for (let page = 0; page < range.count; page += 1) {
    doc.switchToPage(range.start + page);
    outsideTextArea(doc, () => {
      doc.fillColor(MUTED).font("Helvetica").fontSize(7).text(`Página ${page + 1} de ${range.count}`, MARGIN, doc.page.height - MARGIN + 10, { width: CONTENT_WIDTH, align: "right", lineBreak: false });
    });
  }

  doc.end();
  return done;
}
