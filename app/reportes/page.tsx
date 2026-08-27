import type { Metadata } from "next";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { AnalysisForm } from "@/features/analysis/analysis-form";

export const metadata: Metadata = {
  title: "Reportar análisis",
  description: "Formulario público de análisis de causa raíz con metodología 6M y cinco porqués.",
  robots: { index: false, follow: false },
};

/** Public entry point. It renders the four sections of the form and nothing else: no session,
 *  no navigation, and no access to the dashboard, the listing or any stored analysis. */
export default function PublicReportPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-white">
        <div className="shell flex flex-col items-center justify-between gap-4 py-5 sm:flex-row sm:gap-6">
          <Image src="/logo-cruz-roja.svg" width={176} height={86} className="h-auto w-[150px]" alt="Cruz Roja Colombiana Seccional Antioquia" priority />
          <Image src="/logo-6mq5.png" width={520} height={285} sizes="180px" className="h-auto w-[170px]" alt="6MQ5 — Análisis de Causas" priority />
        </div>
      </header>

      <main className="shell py-8 lg:py-10">
        <div className="mb-7">
          <p className="eyebrow">Reporte institucional</p>
          <h1 className="text-3xl font-black text-ink">Análisis de causa raíz</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Complete las cuatro etapas del formato. Al enviarlo recibirá el código institucional del análisis. No necesita usuario ni contraseña.</p>
        </div>
        <AnalysisForm mode="public" />
      </main>

      <footer className="border-t border-border bg-white py-5 text-center text-xs text-muted">
        <p className="flex items-center justify-center gap-2"><ShieldCheck size={14} className="text-brand" />La información enviada es tratada por el equipo de calidad de la Seccional Antioquia.</p>
        <p className="mt-1">Cruz Roja Colombiana Seccional Antioquia · Metodología 6M + 5 porqués</p>
      </footer>
    </div>
  );
}
