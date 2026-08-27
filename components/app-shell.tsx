import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { UserRole } from "@prisma/client";
import { BarChart3, ClipboardList, LogOut, Plus, Users } from "lucide-react";
import { logout } from "@/features/auth/actions";

const NAVIGATION = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/analisis", label: "Análisis", icon: ClipboardList },
  { href: "/analisis/nuevo", label: "Nuevo análisis", icon: Plus },
] as const;

export function AppShell({ children, email, role }: { children: ReactNode; email: string; role: UserRole }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="shell flex items-center justify-between gap-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/logo-cruz-roja.svg" width={123} height={60} alt="Cruz Roja Colombiana Seccional Antioquia" priority />
            <span className="hidden border-l border-border pl-3 md:block"><Image src="/logo-6mq5.png" width={520} height={285} sizes="170px" className="h-auto w-[170px]" alt="6MQ5 — Análisis de Causas" priority /></span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted lg:block">{email}</span>
            <form action={logout}><button className="icon-button" title="Cerrar sesión"><LogOut size={18} /><span className="sr-only">Cerrar sesión</span></button></form>
          </div>
        </div>
        <nav className="shell flex gap-1 overflow-x-auto pb-3">
          {NAVIGATION.map(({ href, label, icon: Icon }) => <Link className="nav-link" href={href} key={href}><Icon size={17} />{label}</Link>)}
          {role === "SUPERADMIN" ? <Link className="nav-link" href="/usuarios"><Users size={17} />Usuarios</Link> : null}
        </nav>
      </header>
      <main className="shell py-7 lg:py-10">{children}</main>
      <footer className="border-t border-border bg-white py-5 text-center text-xs text-muted">Cruz Roja Colombiana Seccional Antioquia · Metodología 6M + 5 porqués</footer>
    </div>
  );
}
