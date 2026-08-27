import Image from "next/image";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return <main className="login-page"><section className="login-card"><div className="mb-7 flex justify-center"><Image src="/logo-cruz-roja.svg" width={176} height={86} alt="Cruz Roja Colombiana Seccional Antioquia" priority /></div><div className="mb-7 text-center"><p className="eyebrow">Seccional Antioquia</p><h1 className="text-3xl font-black text-ink">Análisis de causa raíz</h1><p className="mt-2 text-sm leading-6 text-muted">Gestión institucional con metodología 6M y tres porqués.</p></div><LoginForm /><p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted"><ShieldCheck size={15} className="text-brand" />Acceso exclusivo para personal autorizado</p></section></main>;
}
