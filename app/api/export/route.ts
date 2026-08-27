import { NextResponse } from "next/server";
import { buildAnalysisWorkbook } from "@/features/analysis/export-workbook";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  if (!(await getSessionUser())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const analyses = await prisma.analysis.findMany({ include: { categories: { include: { subcauses: true } }, mainCauses: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "desc" } });
  const workbook = buildAnalysisWorkbook(analyses);
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="analisis-m6q5-${new Date().toISOString().slice(0, 10)}.xlsx"` } });
}
