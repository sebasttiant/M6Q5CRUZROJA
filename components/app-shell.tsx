import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, ClipboardList, LogOut, Plus } from "lucide-react";
import { logout } from "@/features/auth/actions";

const NAVIGATION = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/analisis", label: "Análisis", icon: ClipboardList },
  { href: "/analisis/nuevo", label: "Nuevo análisis", icon: Plus },
] as const;

export function AppShell({ children, email }: { children: ReactNode; email: string }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/logo-cruz-roja.svg" width={123} height={60} alt="Cruz Roja Colombiana Seccional Antioquia" priority />
            <span className="hidden border-l border-border pl-3 text-sm font-semibold text-ink md:block">Análisis de causa raíz</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted lg:block">{email}</span>
            <form action={logout}><button className="icon-button" title="Cerrar sesión"><LogOut size={18} /><span className="sr-only">Cerrar sesión</span></button></form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {NAVIGATION.map(({ href, label, icon: Icon }) => <Link className="nav-link" href={href} key={href}><Icon size={17} />{label}</Link>)}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">{children}</main>
      <footer className="border-t border-border bg-white py-5 text-center text-xs text-muted">Cruz Roja Colombiana Seccional Antioquia · Metodología 6M + 5 porqués</footer>
    </div>
  );
}
