import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { AnalysisForm } from "@/features/analysis/analysis-form";
import { requireUser } from "@/lib/auth/session";

export default async function NewAnalysisPage() {
  const user = await requireUser();
  return <AppShell email={user.email}><PageHeader eyebrow="Nuevo registro" title="Crear análisis" description="Complete las cuatro etapas. Los datos se validan tanto en el navegador como en el servidor." /><AnalysisForm /></AppShell>;
}
