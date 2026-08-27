import Link from "next/link";
import { Download, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { STATUS_LABELS } from "@/features/analysis/constants";
import { requireUser } from "@/lib/auth/session";
import { analysisScope } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

interface SearchParams { q?: string; status?: string }

export default async function AnalysesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const filters = await searchParams;
  const validStatus = filters.status && Object.hasOwn(STATUS_LABELS, filters.status) ? filters.status as "BORRADOR" | "EN_ANALISIS" | "PENDIENTE_PLAN" | "CERRADO" : undefined;
  const analyses = await prisma.analysis.findMany({
    where: {
      ...analysisScope(user),
      ...(validStatus ? { status: validStatus } : {}),
      ...(filters.q ? { OR: [{ code: { contains: filters.q, mode: "insensitive" } }, { process: { contains: filters.q, mode: "insensitive" } }, { finding: { contains: filters.q, mode: "insensitive" } }] } : {}),
    },
    include: { categories: true }, orderBy: { createdAt: "desc" }, take: 100,
  });
  return <AppShell email={user.email} role={user.role}>
    <PageHeader eyebrow="Trazabilidad" title="Análisis registrados" description="Consulte los registros más recientes y su estado." action={<div className="flex gap-2"><a className="button button-secondary" href="/api/export"><Download size={17} />Excel</a><Link className="button button-primary" href="/analisis/nuevo"><Plus size={17} />Nuevo</Link></div>} />
    <form className="filter-bar"><label className="search-field"><Search size={17} /><input name="q" defaultValue={filters.q} placeholder="Código, proceso o hallazgo" /></label><select name="status" defaultValue={filters.status ?? "TODOS"}><option value="TODOS">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="button button-secondary">Filtrar</button></form>
    <div className="table-wrap"><table><thead><tr><th>Código</th><th>Fecha</th><th>Proceso</th><th>Responsable</th><th>Estado</th><th>Valoración máx.</th></tr></thead><tbody>{analyses.map((analysis) => <tr key={analysis.id}><td><Link className="font-bold text-brand hover:underline" href={`/analisis/${analysis.id}`}>{analysis.code}</Link></td><td>{analysis.eventDate.toLocaleDateString("es-CO", { timeZone: "UTC" })}</td><td>{analysis.process}</td><td>{analysis.firstName} {analysis.lastName}</td><td><span className={`status status-${analysis.status.toLowerCase()}`}>{STATUS_LABELS[analysis.status]}</span></td><td>{Math.max(0, ...analysis.categories.map(({ valuation }) => valuation))}</td></tr>)}</tbody></table>{analyses.length === 0 ? <p className="empty">No hay análisis que coincidan con los filtros.</p> : null}</div>
  </AppShell>;
}
