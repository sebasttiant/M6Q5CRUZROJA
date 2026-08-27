import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { buildAnalysisPdf } from "@/features/analysis/export-pdf";
import { getSessionUser } from "@/lib/auth/session";
import { analysisScope } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

let cachedLogo: Buffer | null | undefined;

async function institutionalLogo(): Promise<Buffer | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    cachedLogo = await readFile(path.join(process.cwd(), "public", "logo-6mq5.png"));
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Indique el análisis a exportar." }, { status: 400 });

  // analysisScope keeps a USER from exporting an analysis that is not theirs.
  const analysis = await prisma.analysis.findFirst({
    where: { id, ...analysisScope(user) },
    include: { categories: { include: { subcauses: true } }, mainCauses: { orderBy: { position: "asc" } } },
  });
  if (!analysis) return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });

  const pdf = await buildAnalysisPdf(analysis, await institutionalLogo());
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${analysis.code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
