import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { CATEGORIES, STATUS_LABELS } from "@/features/analysis/constants";
import { updateAnalysisStatus } from "@/features/analysis/actions";
import { requireUser } from "@/lib/auth/session";
import { analysisScope } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const analysis = await prisma.analysis.findFirst({ where: { id, ...analysisScope(user) }, include: { categories: { include: { subcauses: true }, orderBy: { category: "asc" } }, mainCauses: { orderBy: { position: "asc" } } } });
  if (!analysis) notFound();
  const statusAction = updateAnalysisStatus.bind(null, analysis.id);
  return <AppShell email={user.email} role={user.role}>
    <PageHeader eyebrow={analysis.code} title={analysis.finding} description={`${analysis.process} · ${analysis.eventDate.toLocaleDateString("es-CO", { timeZone: "UTC" })}`} action={<form action={statusAction} className="flex gap-2"><select name="status" defaultValue={analysis.status}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="button button-secondary">Actualizar</button></form>} />
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6"><section className="panel"><h2 className="detail-title">Evaluación 6M</h2><div className="grid gap-4 md:grid-cols-2">{analysis.categories.map((category) => <article className="category-card" key={category.id}><div className="flex justify-between gap-2"><h3>{CATEGORIES.find(({ key }) => key === category.category)?.label}</h3><span className="valuation">{category.valuation}</span></div>{category.subcauses.length ? <ul className="mt-3 space-y-2">{category.subcauses.map((subcause) => <li className="flex justify-between gap-3 text-sm" key={subcause.id}><span>{subcause.description}</span><strong>Impacto {subcause.impact}</strong></li>)}</ul> : <p className="mt-3 text-sm text-muted">Sin subcausas registradas.</p>}</article>)}</div></section>
      <section className="panel"><h2 className="detail-title">Tres porqués</h2><div className="space-y-5">{analysis.mainCauses.map((cause) => <article className="cause-card" key={cause.id}><h3>Causa {cause.position}: {cause.cause}</h3><p className="mt-1 text-sm text-muted">Subcausa: {cause.subcause}</p><ol className="mt-4 grid gap-2 md:grid-cols-3">{[cause.why1, cause.why2, cause.why3].map((why, index) => <li className="why-card" key={index}><span>{index + 1}</span>{why}</li>)}</ol></article>)}</div></section></div>
      <aside className="space-y-5"><section className="panel"><h2 className="detail-title">Responsable</h2><dl className="detail-list"><div><dt>Nombre</dt><dd>{analysis.firstName} {analysis.lastName}</dd></div><div><dt>Correo</dt><dd>{analysis.email}</dd></div><div><dt>Estado</dt><dd><span className={`status status-${analysis.status.toLowerCase()}`}>{STATUS_LABELS[analysis.status]}</span></dd></div></dl></section><section className="root-card"><p className="eyebrow text-white/70">Causa raíz final</p><p>{analysis.rootCause}</p></section></aside>
    </div>
  </AppShell>;
}
