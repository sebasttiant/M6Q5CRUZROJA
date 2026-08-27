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

/**
 * Institutional M1..M6 order. It drives the form layout, the dashboard chart, the Excel columns,
 * the PDF table and the tie-break between two categories that score the same valuation, so the
 * whole product presents the six categories in one single order.
 */
export const CATEGORIES = [
  {
    key: "MANO_DE_OBRA",
    m: "M1",
    label: "Mano de obra",
    hint: "Están relacionadas con el factor humano. Se pueden considerar las siguientes variables: conocimiento de las tareas, compromiso, carga de trabajo, competencias, responsabilidades y habilidad.",
  },
  {
    key: "METODO",
    m: "M2",
    label: "Método",
    hint: "Están relacionadas con los pasos para llevar a cabo una actividad. Se pueden considerar las siguientes variables: estandarización de los procesos, definición de operaciones, documentación adecuada y control de la documentación.",
  },
  {
    key: "MAQUINARIA_EQUIPOS",
    m: "M3",
    label: "Maquinaria/equipos",
    hint: "Están relacionadas con las maquinarias y equipos que requieren los procesos. Se pueden considerar las siguientes variables: infraestructura, sistemas o aplicativos tecnológicos, mantenimientos preventivos, capacidad de las máquinas y condiciones de operación.",
  },
  {
    key: "MATERIALES",
    m: "M4",
    label: "Materiales",
    hint: "Están relacionadas con los materiales e insumos que requiere el proceso. Se pueden considerar las siguientes variables: proveedores, variabilidad de los materiales e insumos, tipos de materiales e insumos y cambios en su composición.",
  },
  {
    key: "MEDIO_AMBIENTE",
    m: "M5",
    label: "Medio ambiente",
    hint: "Están relacionadas con el entorno donde se desarrollan los procesos. Se pueden considerar las siguientes variables: condiciones del área de trabajo, condiciones climáticas y bienestar.",
  },
  {
    key: "MEDICION",
    m: "M6",
    label: "Medición",
    hint: "Están relacionadas con los controles e inspecciones del proceso. Se pueden considerar las siguientes variables: disponibilidad de controles, criterios adecuados para medir, calibraciones, tamaños de muestra y sesgo en las medidas.",
  },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** The source spreadsheet reserves three impact cells per 6M category (F30, F31, F32). */
export const MAX_SUBCAUSES_PER_CATEGORY = 3;

/** Only the two highest scoring categories are carried into the why-analysis section. */
export const MAX_MAIN_CAUSES = 2;

export const WHY_FIELDS = ["why1", "why2", "why3"] as const;

export type WhyField = (typeof WHY_FIELDS)[number];
