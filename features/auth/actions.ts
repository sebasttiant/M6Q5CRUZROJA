"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";

export interface LoginState { error?: string }

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const authenticated = await createSession(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!authenticated) return { error: "Credenciales inválidas." };
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
