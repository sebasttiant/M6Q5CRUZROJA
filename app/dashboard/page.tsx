import Link from "next/link";
import { Activity, CheckCircle2, CircleDot, ClipboardList, Plus, TrendingUp } from "lucide-react";
import type { AnalysisStatus, Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { CATEGORIES, STATUS_LABELS } from "@/features/analysis/constants";
import { buildMonthlyTrend, summarizeDashboard } from "@/features/analysis/dashboard";
import { requireUser } from "@/lib/auth/session";
import { analysisScope } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

interface DashboardFilters { status?: string; process?: string; from?: string; to?: string }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardFilters> }) {
  const user = await requireUser();
  const filters = await searchParams;
  const validStatus = filters.status && Object.hasOwn(STATUS_LABELS, filters.status) ? filters.status as AnalysisStatus : undefined;
  const where: Prisma.AnalysisWhereInput = {
    ...analysisScope(user),
    ...(validStatus ? { status: validStatus } : {}),
    ...(filters.process ? { process: filters.process } : {}),
    ...((filters.from || filters.to) ? { eventDate: { ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}), ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}) } } : {}),
  };

  const [recentAnalyses, statusGroups, categoryGroups, impactGroups, processGroups, processOptions, valuationAggregate, trendGroups] = await Promise.all([
    prisma.analysis.findMany({ where, select: { id: true, code: true, process: true, finding: true, status: true, eventDate: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.analysis.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.categoryAssessment.groupBy({ by: ["category"], where: { analysis: where }, _avg: { valuation: true }, _count: { _all: true } }),
    prisma.subcause.groupBy({ by: ["impact"], where: { assessment: { analysis: where } }, _count: { _all: true } }),
    prisma.analysis.groupBy({ by: ["process"], where, _count: { _all: true }, orderBy: { _count: { process: "desc" } }, take: 6 }),
    prisma.analysis.findMany({ where: analysisScope(user), distinct: ["process"], select: { process: true }, orderBy: { process: "asc" } }),
    prisma.categoryAssessment.aggregate({ where: { analysis: where }, _max: { valuation: true } }),
    prisma.analysis.groupBy({ by: ["eventDate"], where, _count: { _all: true }, orderBy: { eventDate: "asc" } }),
  ]);

  const { total, closed, open } = summarizeDashboard(statusGroups);
  const maxValuation = valuationAggregate._max.valuation ?? 0;
  const maxStatus = Math.max(1, ...statusGroups.map((group) => group._count._all));
  const maxCategory = Math.max(1, ...categoryGroups.map((group) => group._avg.valuation ?? 0));
  const maxProcess = Math.max(1, ...processGroups.map((group) => group._count._all));
  const trendEntries = buildMonthlyTrend(trendGroups);
  const maxTrend = Math.max(1, ...trendEntries.map(({ count }) => count));

  return <AppShell email={user.email} role={user.role}>
    <PageHeader eyebrow="Visión institucional" title="Dashboard de calidad" description="Seguimiento de análisis, criticidad y evolución operativa." action={<Link href="/analisis/nuevo" className="button button-primary"><Plus size={18} />Nuevo análisis</Link>} />
    <form className="filter-bar mb-6"><select name="status" defaultValue={filters.status ?? "TODOS"}><option value="TODOS">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select name="process" defaultValue={filters.process ?? ""}><option value="">Todos los procesos</option>{processOptions.map(({ process }) => <option key={process} value={process}>{process}</option>)}</select><input aria-label="Fecha inicial" name="from" type="date" defaultValue={filters.from} /><input aria-label="Fecha final" name="to" type="date" defaultValue={filters.to} /><button className="button button-secondary">Aplicar filtros</button></form>
    <section className="kpi-grid"><Kpi icon={<ClipboardList />} label="Análisis" value={total} detail="en el periodo filtrado" /><Kpi icon={<Activity />} label="Abiertos" value={open} detail="requieren seguimiento" /><Kpi icon={<CheckCircle2 />} label="Cerrados" value={closed} detail={`${total ? Math.round((closed / total) * 100) : 0}% de cierre`} /><Kpi icon={<TrendingUp />} label="Valoración máxima" value={maxValuation} detail="producto de impactos 6M" /></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="panel"><h2 className="chart-title">Distribución por estado</h2><div className="chart-list">{Object.keys(STATUS_LABELS).map((status) => { const count = statusGroups.find((group) => group.status === status)?._count._all ?? 0; return <Bar key={status} label={STATUS_LABELS[status]} value={count} maximum={maxStatus} />; })}</div></section>
      <section className="panel"><h2 className="chart-title">Valoración promedio por 6M</h2><div className="chart-list">{CATEGORIES.map(({ key, label }) => { const value = categoryGroups.find((group) => group.category === key)?._avg.valuation ?? 0; return <Bar key={key} label={label} value={Number(value.toFixed(1))} maximum={maxCategory} />; })}</div></section>
      <section className="panel"><h2 className="chart-title">Distribución por proceso</h2>{processGroups.length ? <div className="chart-list">{processGroups.map((group) => <Bar key={group.process} label={group.process} value={group._count._all} maximum={maxProcess} />)}</div> : <p className="empty">No hay procesos para los filtros seleccionados.</p>}</section>
      <section className="panel"><h2 className="chart-title">Impactos registrados</h2><div className="grid grid-cols-3 gap-3">{[1, 2, 3].map((impact) => <div className={`impact-card impact-${impact}`} key={impact}><CircleDot size={20} /><strong>{impactGroups.find((group) => group.impact === impact)?._count._all ?? 0}</strong><span>{impact === 1 ? "Bajo" : impact === 2 ? "Medio" : "Alto"}</span></div>)}</div></section>
      <section className="panel"><h2 className="chart-title">Tendencia de análisis</h2>{trendEntries.length > 1 ? <div className="trend-chart">{trendEntries.map(({ label, count }) => <div className="trend-column" key={label}><span>{count}</span><i style={{ height: `${Math.max(8, (count / maxTrend) * 110)}px` }} /><small>{label}</small></div>)}</div> : <p className="empty">Se necesitan datos de más de un mes para mostrar una tendencia útil.</p>}</section>
    </div>
    <section className="panel mt-6"><div className="mb-4 flex items-center justify-between"><h2 className="chart-title mb-0">Análisis recientes</h2><Link className="text-button" href="/analisis">Ver todos</Link></div><div className="table-wrap border-0"><table><thead><tr><th>Código</th><th>Proceso</th><th>Hallazgo</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>{recentAnalyses.map((analysis) => <tr key={analysis.id}><td><Link href={`/analisis/${analysis.id}`} className="font-bold text-brand">{analysis.code}</Link></td><td>{analysis.process}</td><td className="max-w-md truncate">{analysis.finding}</td><td><span className={`status status-${analysis.status.toLowerCase()}`}>{STATUS_LABELS[analysis.status]}</span></td><td>{analysis.eventDate.toLocaleDateString("es-CO", { timeZone: "UTC" })}</td></tr>)}</tbody></table>{total === 0 ? <p className="empty">Aún no hay datos para estos filtros.</p> : null}</div></section>
  </AppShell>;
}

function Kpi({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) {
  return <article className="kpi"><div className="kpi-icon">{icon}</div><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function Bar({ label, value, maximum }: { label: string; value: number; maximum: number }) {
  return <div><div className="mb-1 flex justify-between gap-3 text-sm"><span>{label}</span><strong>{value}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(value ? 4 : 0, (value / maximum) * 100)}%` }} /></div></div>;
}
