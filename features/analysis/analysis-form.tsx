"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { createAnalysis } from "./actions";
import { ANALYSIS_STATUS, CATEGORIES, MAX_SUBCAUSES_PER_CATEGORY, WHY_FIELDS, type CategoryKey, type WhyField } from "./constants";
import { analysisSchema } from "./schema";
import { calculateValuation, rankMainCauseCandidates } from "./valuation";

interface SubcauseForm { description: string; impact: number | null }
interface CategoryForm { category: CategoryKey; subcauses: SubcauseForm[] }
/** Whys are held per 6M category so re-ranking section 02 never moves an answer to another cause. */
type CauseDraft = { subcause: string; touchedSubcause: boolean } & Record<WhyField, string>;
interface FormState {
  firstName: string; lastName: string; email: string; process: string; eventDate: string; finding: string;
  status: (typeof ANALYSIS_STATUS)[keyof typeof ANALYSIS_STATUS]; categories: CategoryForm[];
  drafts: Partial<Record<CategoryKey, CauseDraft>>; rootCause: string;
}

const EMPTY_DRAFT: CauseDraft = { subcause: "", touchedSubcause: false, why1: "", why2: "", why3: "" };

function initialState(): FormState {
  return {
    firstName: "", lastName: "", email: "", process: "", eventDate: new Date().toISOString().slice(0, 10), finding: "",
    status: ANALYSIS_STATUS.EN_ANALISIS,
    categories: CATEGORIES.map(({ key }) => ({ category: key, subcauses: [{ description: "", impact: null }] })),
    drafts: {}, rootCause: "",
  };
}

export function AnalysisForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Section 03 is derived from section 02: the two highest valuations of the 6M block. */
  const candidates = useMemo(() => rankMainCauseCandidates(values.categories), [values.categories]);

  const mainCauses = candidates.map((candidate) => {
    const label = CATEGORIES.find(({ key }) => key === candidate.category)?.label ?? candidate.category;
    const draft = values.drafts[candidate.category] ?? EMPTY_DRAFT;
    return {
      ...candidate,
      label,
      draft,
      // Until the analyst edits it, the associated subcause follows the highest impact one.
      subcause: draft.touchedSubcause ? draft.subcause : candidate.subcause,
    };
  });

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateDraft(category: CategoryKey, patch: Partial<CauseDraft>) {
    setValues((current) => ({ ...current, drafts: { ...current.drafts, [category]: { ...(current.drafts[category] ?? EMPTY_DRAFT), ...patch } } }));
  }

  function updateSubcause(categoryIndex: number, subcauseIndex: number, patch: Partial<SubcauseForm>) {
    setValues((current) => ({ ...current, categories: current.categories.map((category, index) => index !== categoryIndex ? category : { ...category, subcauses: category.subcauses.map((subcause, subIndex) => subIndex === subcauseIndex ? { ...subcause, ...patch } : subcause) }) }));
  }

  function addSubcause(categoryIndex: number) {
    setValues((current) => ({ ...current, categories: current.categories.map((category, index) => index === categoryIndex && category.subcauses.length < MAX_SUBCAUSES_PER_CATEGORY ? { ...category, subcauses: [...category.subcauses, { description: "", impact: null }] } : category) }));
  }

  function removeSubcause(categoryIndex: number, subcauseIndex: number) {
    setValues((current) => ({ ...current, categories: current.categories.map((category, index) => index === categoryIndex ? { ...category, subcauses: category.subcauses.filter((_, subIndex) => subIndex !== subcauseIndex) } : category) }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalized = {
      ...values,
      categories: values.categories.map((category) => ({
        ...category,
        subcauses: category.subcauses.filter((subcause) => subcause.description.trim() || subcause.impact !== null),
      })),
      mainCauses: mainCauses.map((cause) => ({
        cause: cause.label, subcause: cause.subcause,
        why1: cause.draft.why1, why2: cause.draft.why2, why3: cause.draft.why3,
      })),
    };
    const clientValidation = analysisSchema.safeParse(normalized);
    if (!clientValidation.success) {
      setError(clientValidation.error.issues[0]?.message ?? "Revise los datos del formulario.");
      return;
    }
    setPending(true);
    const result = await createAnalysis(clientValidation.data);
    setPending(false);
    if (!result.ok || !result.id) { setError(result.error ?? "No se pudo guardar."); return; }
    router.push(`/analisis/${result.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      <section className="panel">
        <div className="section-heading"><span>01</span><div><h2>Identificación del análisis</h2><p>Información básica y hallazgo que origina la investigación.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="field">Nombre *<input value={values.firstName} onChange={(event) => setField("firstName", event.target.value)} required /></label>
          <label className="field">Apellido *<input value={values.lastName} onChange={(event) => setField("lastName", event.target.value)} required /></label>
          <label className="field">Correo *<input type="email" value={values.email} onChange={(event) => setField("email", event.target.value)} required /></label>
          <label className="field">Proceso *<input value={values.process} onChange={(event) => setField("process", event.target.value)} placeholder="Ej. Gestión del riesgo" required /></label>
          <label className="field">Fecha *<input type="date" value={values.eventDate} onChange={(event) => setField("eventDate", event.target.value)} required /></label>
          <label className="field">Estado<select value={values.status} onChange={(event) => setField("status", event.target.value as FormState["status"])}><option value="BORRADOR">Borrador</option><option value="EN_ANALISIS">En análisis</option><option value="PENDIENTE_PLAN">Pendiente de plan</option><option value="CERRADO">Cerrado</option></select></label>
        </div>
        <label className="field mt-4">Hallazgo *<textarea rows={4} value={values.finding} onChange={(event) => setField("finding", event.target.value)} placeholder="Describa claramente la situación, evidencia y alcance del hallazgo." required /></label>
      </section>

      <section className="panel">
        <div className="section-heading"><span>02</span><div><h2>Identificación de causas — 6M</h2><p>Máximo {MAX_SUBCAUSES_PER_CATEGORY} subcausas por categoría. La valoración multiplica los impactos diligenciados; sin impactos es 0.</p></div></div>
        <div className="grid gap-5 xl:grid-cols-2">
          {values.categories.map((category, categoryIndex) => {
            const metadata = CATEGORIES.find(({ key }) => key === category.category);
            const valuation = calculateValuation(category.subcauses.map(({ impact }) => impact));
            const full = category.subcauses.length >= MAX_SUBCAUSES_PER_CATEGORY;
            return <article className="category-card" key={category.category}>
              <div className="flex items-center justify-between gap-3"><h3>{metadata?.label}</h3><span className="valuation">Valoración: {valuation}</span></div>
              <div className="mt-4 space-y-3">
                {category.subcauses.map((subcause, subcauseIndex) => <div className="grid grid-cols-[1fr_92px_auto] items-end gap-2" key={`${category.category}-${subcauseIndex}`}>
                  <label className="field text-xs">Subcausa {subcauseIndex + 1}<input value={subcause.description} onChange={(event) => updateSubcause(categoryIndex, subcauseIndex, { description: event.target.value })} placeholder="Descripción" /></label>
                  <label className="field text-xs">Impacto<select value={subcause.impact ?? ""} onChange={(event) => updateSubcause(categoryIndex, subcauseIndex, { impact: event.target.value ? Number(event.target.value) : null })}><option value="">—</option><option value="1">1 Bajo</option><option value="2">2 Medio</option><option value="3">3 Alto</option></select></label>
                  <button type="button" className="icon-button mb-0.5" onClick={() => removeSubcause(categoryIndex, subcauseIndex)} disabled={category.subcauses.length === 1} title="Eliminar subcausa"><Trash2 size={16} /></button>
                </div>)}
              </div>
              {full
                ? <p className="mt-3 text-xs text-muted">Máximo {MAX_SUBCAUSES_PER_CATEGORY} subcausas alcanzado.</p>
                : <button type="button" className="text-button mt-3" onClick={() => addSubcause(categoryIndex)}><Plus size={15} />Agregar subcausa</button>}
            </article>;
          })}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading"><span>03</span><div><h2>Causas principales y tres porqués</h2><p>Las causas se traen automáticamente: las dos categorías con mayor valoración en la sección 02.</p></div></div>
        {mainCauses.length === 0
          ? <p className="text-sm text-muted">Asigne impacto a por lo menos una subcausa en la sección 02 para que el sistema proponga las causas principales.</p>
          : <div className="space-y-5">
              {mainCauses.map((cause, index) => <article className="cause-card" key={cause.category}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3>Causa principal {index + 1}: {cause.label}</h3>
                  <span className="valuation">Valoración: {cause.valuation}</span>
                </div>
                <label className="field">Subcausa asociada *<input value={cause.subcause} onChange={(event) => updateDraft(cause.category, { subcause: event.target.value, touchedSubcause: true })} placeholder="Subcausa de mayor impacto de esta categoría" /></label>
                <div className="mt-4 grid gap-3 md:grid-cols-3">{WHY_FIELDS.map((field, whyIndex) => <label className="field text-xs" key={field}>¿Por qué? {whyIndex + 1} *<textarea rows={4} value={cause.draft[field]} onChange={(event) => updateDraft(cause.category, { [field]: event.target.value })} /></label>)}</div>
              </article>)}
            </div>}
      </section>

      <section className="panel border-l-4 border-l-brand">
        <div className="section-heading"><span>04</span><div><h2>Causa raíz final</h2><p>Sintetice la condición de fondo que debe ser tratada.</p></div></div>
        <label className="field">Causa raíz *<textarea rows={5} value={values.rootCause} onChange={(event) => setField("rootCause", event.target.value)} required /></label>
      </section>

      {error ? <div className="error-banner" role="alert"><AlertCircle size={20} />{error}</div> : null}
      <div className="sticky bottom-4 flex justify-end"><button className="button button-primary shadow-xl" disabled={pending}><Save size={18} />{pending ? "Guardando…" : "Guardar análisis"}</button></div>
    </form>
  );
}
