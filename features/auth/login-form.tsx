"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="space-y-5">
      <label className="field">Correo institucional<input name="email" type="email" autoComplete="email" required /></label>
      <label className="field">Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button className="button button-primary w-full" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
