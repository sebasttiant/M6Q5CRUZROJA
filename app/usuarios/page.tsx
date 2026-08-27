import { ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { CreateUserForm, UserControls } from "@/features/users/user-forms";
import { requireSuperadmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const ROLE_LABELS = { SUPERADMIN: "Superadministrador", ADMIN: "Administrador", USER: "Usuario" } as const;

export default async function UsersPage() {
  const currentUser = await requireSuperadmin();
  const users = await prisma.adminUser.findMany({ select: { id: true, email: true, role: true, active: true, createdAt: true }, orderBy: [{ role: "asc" }, { email: "asc" }] });
  return <AppShell email={currentUser.email} role={currentUser.role}>
    <PageHeader eyebrow="Control de acceso" title="Usuarios y roles" description="Administre el acceso institucional sin exponer credenciales ni información sensible." />
    <section className="mb-6 grid gap-4 sm:grid-cols-3">
      <article className="access-card"><Users /><strong>{users.length}</strong><span>usuarios registrados</span></article>
      <article className="access-card"><ShieldCheck /><strong>{users.filter(({ active }) => active).length}</strong><span>accesos activos</span></article>
      <article className="access-card"><ShieldCheck /><strong>{users.filter(({ role }) => role === "ADMIN").length}</strong><span>administradores operativos</span></article>
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-4">{users.map((user) => <article className="panel user-card" key={user.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 break-all font-bold">{user.email}</p><p className="mt-1 text-xs text-muted">Creado el {user.createdAt.toLocaleDateString("es-CO")}</p></div><div className="flex gap-2"><span className="role-badge">{ROLE_LABELS[user.role]}</span><span className={user.active ? "active-badge" : "inactive-badge"}>{user.active ? "Activo" : "Inactivo"}</span></div></div>
        {user.role === "SUPERADMIN" ? <p className="mt-4 rounded-xl bg-brand-soft p-3 text-sm font-semibold text-brand">Acceso principal protegido. No puede desactivarse ni modificarse desde esta pantalla.</p> : <div className="mt-4"><UserControls id={user.id} active={user.active} /></div>}
      </article>)}</section>
      <CreateUserForm />
    </div>
  </AppShell>;
}
