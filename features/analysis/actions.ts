"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatAnalysisCode } from "./code";
import { analysisSchema, type AnalysisInput } from "./schema";
import { calculateValuation } from "./valuation";

export interface AnalysisActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createAnalysis(values: AnalysisInput): Promise<AnalysisActionResult> {
  await requireUser();
  const parsed = analysisSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos marcados.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    const analysis = await prisma.$transaction(async (tx) => {
      const year = new Date(`${parsed.data.eventDate}T00:00:00.000Z`).getUTCFullYear();
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
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email: parsed.data.email.toLowerCase(),
          process: parsed.data.process,
          eventDate: new Date(`${parsed.data.eventDate}T00:00:00.000Z`),
          finding: parsed.data.finding,
          status: parsed.data.status,
          rootCause: parsed.data.rootCause,
          categories: {
            create: parsed.data.categories.map((category) => ({
              category: category.category,
              valuation: calculateValuation(category.subcauses.map((subcause) => subcause.impact)),
              subcauses: { create: category.subcauses },
            })),
          },
          mainCauses: { create: parsed.data.mainCauses.map((cause, index) => ({ ...cause, position: index + 1 })) },
        },
      });
    });
    revalidatePath("/dashboard");
    revalidatePath("/analisis");
    return { ok: true, id: analysis.id };
  } catch (error) {
    console.error("createAnalysis failed", error);
    return { ok: false, error: "No se pudo guardar el análisis. Intente nuevamente." };
  }
}

export async function updateAnalysisStatus(id: string, formData: FormData): Promise<void> {
  await requireUser();
  const status = analysisSchema.shape.status.safeParse(formData.get("status"));
  if (!status.success) return;
  await prisma.analysis.update({ where: { id }, data: { status: status.data } });
  revalidatePath(`/analisis/${id}`);
  revalidatePath("/dashboard");
}
