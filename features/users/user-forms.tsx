"use client";

import { useActionState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { createUser, resetUserPassword, setUserActive } from "./actions";

function Feedback({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) return <p className="error text-sm" role="alert">{state.error}</p>;
  if (state.success) return <p className="success-message" role="status">{state.success}</p>;
  return null;
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, {});
  return <form action={action} className="panel space-y-4">
    <div className="section-heading"><span><UserPlus size={17} /></span><div><h2>Crear usuario</h2><p>Asigne acceso operativo o acceso personal con alcance limitado.</p></div></div>
    <label className="field">Correo institucional<input name="email" type="email" autoComplete="off" required /></label>
    <label className="field">Contraseña temporal<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
    <label className="field">Rol<select name="role" defaultValue="USER"><option value="USER">Usuario</option><option value="ADMIN">Administrador</option></select></label>
    <p className="text-xs text-muted">Mínimo 12 caracteres. El sistema no permite crear otros superadministradores.</p>
    <Feedback state={state} />
    <button className="button button-primary w-full" disabled={pending}>{pending ? "Creando…" : "Crear usuario"}</button>
  </form>;
}

export function UserControls({ id, active }: { id: string; active: boolean }) {
  const [activeState, activeAction, activePending] = useActionState(setUserActive, {});
  const [passwordState, passwordAction, passwordPending] = useActionState(resetUserPassword, {});
  return <div className="space-y-3">
    <form action={activeAction}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!active)} />
      <button className="button button-secondary w-full" disabled={activePending}>{activePending ? "Actualizando…" : active ? "Desactivar" : "Activar"}</button>
      <Feedback state={activeState} />
    </form>
    <form action={passwordAction} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="id" value={id} />
      <label className="field flex-1"><span className="sr-only">Nueva contraseña</span><input name="password" type="password" autoComplete="new-password" minLength={12} placeholder="Nueva contraseña (12+ caracteres)" required /></label>
      <button className="button button-secondary" disabled={passwordPending}><KeyRound size={16} />{passwordPending ? "Guardando…" : "Restablecer"}</button>
    </form>
    <Feedback state={passwordState} />
  </div>;
}
