"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";
import { loginSchema } from "./schema";

export interface LoginState { error?: string }

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Credenciales inválidas." };
  const authenticated = await createSession(parsed.data.email, parsed.data.password);
  if (!authenticated) return { error: "Credenciales inválidas." };
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
