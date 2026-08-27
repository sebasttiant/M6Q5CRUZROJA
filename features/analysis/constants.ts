export const ANALYSIS_STATUS = {
  BORRADOR: "BORRADOR",
  EN_ANALISIS: "EN_ANALISIS",
  PENDIENTE_PLAN: "PENDIENTE_PLAN",
  CERRADO: "CERRADO",
} as const;

export const STATUS_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  EN_ANALISIS: "En análisis",
  PENDIENTE_PLAN: "Pendiente de plan",
  CERRADO: "Cerrado",
};

export const CATEGORIES = [
  { key: "MANO_DE_OBRA", label: "Mano de obra" },
  { key: "MEDICION", label: "Medición" },
  { key: "METODO", label: "Método" },
  { key: "MATERIALES", label: "Materiales" },
  { key: "MAQUINARIA_EQUIPOS", label: "Maquinaria/equipos" },
  { key: "MEDIO_AMBIENTE", label: "Medio ambiente" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** The source spreadsheet reserves three impact cells per 6M category (F30, F31, F32). */
export const MAX_SUBCAUSES_PER_CATEGORY = 3;

/** Only the two highest scoring categories are carried into the why-analysis section. */
export const MAX_MAIN_CAUSES = 2;

export const WHY_FIELDS = ["why1", "why2", "why3"] as const;

export type WhyField = (typeof WHY_FIELDS)[number];
