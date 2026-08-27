"use server";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { analysisScope } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { formatAnalysisCode } from "./code";
import { ANALYSIS_STATUS } from "./constants";
import { analysisSchema, type AnalysisInput, type AnalysisParsed } from "./schema";
import { calculateValuation } from "./valuation";
import { z } from "zod";

export interface AnalysisActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export interface PublicAnalysisActionResult {
  ok: boolean;
  /** Only the institutional code is handed back; anonymous reporters never receive internal ids. */
  code?: string;
  error?: string;
}

/** Budget per client for the anonymous report form. */
const PUBLIC_REPORT_WINDOW = { limit: 20, windowMs: 60 * 60 * 1000 };

async function persistAnalysis(data: AnalysisParsed, creatorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const year = new Date(`${data.eventDate}T00:00:00.000Z`).getUTCFullYear();
    const rows = await tx.$queryRaw<Array<{ lastValue: number }>>(Prisma.sql`
      INSERT INTO "AnnualSequence" ("year", "lastValue", "updatedAt")
      VALUES (${year}, 1, NOW())
      ON CONFLICT ("year") DO UPDATE
      SET "lastValue" = "AnnualSequence"."lastValue" + 1, "updatedAt" = NOW()
      RETURNING "lastValue"
    `);
    const sequence = rows[0]?.lastValue;
    if (!sequence) throw new Error("No fue posible reservar el consecutivo.");

    return tx.analysis.create({
      data: {
        code: formatAnalysisCode(sequence, year),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        process: data.process,
        eventDate: new Date(`${data.eventDate}T00:00:00.000Z`),
        finding: data.finding,
        status: data.status,
        rootCause: data.rootCause,
        creatorId,
        categories: {
          create: data.categories.map((category) => ({
            category: category.category,
            valuation: calculateValuation(category.subcauses.map((subcause) => subcause.impact)),
            subcauses: { create: category.subcauses },
          })),
        },
        mainCauses: { create: data.mainCauses.map((cause, index) => ({ ...cause, position: index + 1 })) },
      },
    });
  });
}

function revalidateAnalysisViews(): void {
  revalidatePath("/dashboard");
  revalidatePath("/analisis");
}

export async function createAnalysis(values: AnalysisInput): Promise<AnalysisActionResult> {
  const user = await requireUser();
  const parsed = analysisSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos marcados.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    const analysis = await persistAnalysis(parsed.data, user.id);
    revalidateAnalysisViews();
    return { ok: true, id: analysis.id };
  } catch (error) {
    console.error("createAnalysis failed", error);
    return { ok: false, error: "No se pudo guardar el análisis. Intente nuevamente." };
  }
}

/** Identifies the caller for rate limiting. Needs the reverse proxy to forward the client address. */
async function clientKey(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "sin-direccion";
}

/**
 * Anonymous submission from /reportes. It never reads or trusts a session, records no creator,
 * and returns only the institutional code.
 */
export async function createPublicAnalysis(values: AnalysisInput): Promise<PublicAnalysisActionResult> {
  const budget = consumeRateLimit(await clientKey(), PUBLIC_REPORT_WINDOW);
  if (!budget.allowed) {
    const minutes = Math.ceil(budget.retryAfterSeconds / 60);
    return { ok: false, error: `Se alcanzó el límite de envíos. Intente nuevamente en ${minutes} minuto${minutes === 1 ? "" : "s"}.` };
  }

  const parsed = analysisSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados." };

  try {
    // A reporter must not be able to file an analysis that is already closed.
    const analysis = await persistAnalysis({ ...parsed.data, status: ANALYSIS_STATUS.EN_ANALISIS }, null);
    revalidateAnalysisViews();
    return { ok: true, code: analysis.code };
  } catch (error) {
    console.error("createPublicAnalysis failed", error);
    return { ok: false, error: "No se pudo guardar el análisis. Intente nuevamente." };
  }
}

export async function updateAnalysisStatus(id: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const input = z.object({ id: z.string().cuid(), status: analysisSchema.shape.status }).safeParse({ id, status: formData.get("status") });
  if (!input.success) return;
  await prisma.analysis.updateMany({ where: { id: input.data.id, ...analysisScope(user) }, data: { status: input.data.status } });
  revalidatePath(`/analisis/${id}`);
  revalidatePath("/dashboard");
}
