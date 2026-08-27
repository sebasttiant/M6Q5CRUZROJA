import Image from "next/image";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return <main className="login-page"><section className="login-card"><div className="mb-6 flex justify-center"><Image src="/logo-6mq5-completo.png" width={880} height={572} sizes="(max-width: 420px) 88vw, 360px" className="h-auto w-[360px] max-w-full" alt="6MQ5 — Análisis de Causas" priority /></div><div className="mb-7 text-center"><h1 className="text-xl font-black text-brand sm:text-2xl">Cruz Roja Colombiana Seccional Antioquia</h1><p className="mt-2 text-sm leading-6 text-muted">Gestión institucional con metodología 6M y cinco porqués.</p></div><LoginForm /><p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted"><ShieldCheck size={15} className="text-brand" />Acceso exclusivo para personal autorizado</p></section></main>;
}
