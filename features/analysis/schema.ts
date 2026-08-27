import { z } from "zod";
import { ANALYSIS_STATUS, CATEGORIES } from "./constants";

const requiredText = z.string().trim().min(1, "Este campo es obligatorio.").max(2000);
const subcauseSchema = z.object({ description: requiredText.max(500), impact: z.coerce.number().int().min(1).max(3) });
const categorySchema = z.object({
  category: z.enum(CATEGORIES.map((item) => item.key)),
  subcauses: z.array(subcauseSchema).max(10),
});
const mainCauseSchema = z.object({
  cause: requiredText.max(500), subcause: requiredText.max(500),
  why1: requiredText.max(1000), why2: requiredText.max(1000), why3: requiredText.max(1000),
  why4: requiredText.max(1000), why5: requiredText.max(1000),
});

export const analysisSchema = z.object({
  firstName: requiredText.max(100), lastName: requiredText.max(100),
  email: z.email("Ingrese un correo válido."), process: requiredText.max(200),
  eventDate: z.iso.date("Ingrese una fecha válida."), finding: requiredText,
  status: z.enum(Object.values(ANALYSIS_STATUS)),
  categories: z.array(categorySchema).length(6).superRefine((items, context) => {
    if (new Set(items.map((item) => item.category)).size !== CATEGORIES.length) context.addIssue({ code: "custom", message: "Debe existir una sola evaluación por cada categoría 6M." });
  }),
  mainCauses: z.array(mainCauseSchema).min(1, "Ingrese al menos una causa principal.").max(2, "Solo se permiten dos causas principales."),
  rootCause: requiredText,
});

export type AnalysisInput = z.input<typeof analysisSchema>;
export type AnalysisParsed = z.output<typeof analysisSchema>;
