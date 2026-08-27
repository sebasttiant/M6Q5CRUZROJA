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
