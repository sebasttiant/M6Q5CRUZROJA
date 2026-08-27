"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth/password";
import { requireSuperadmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createUserSchema, resetPasswordSchema, setUserActiveSchema } from "./schema";

export interface UserActionState {
  error?: string;
  success?: string;
}

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Revise los datos ingresados.";
}

export async function createUser(_previous: UserActionState, formData: FormData): Promise<UserActionState> {
  await requireSuperadmin();
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error.issues) };
  try {
    const { password, ...userData } = parsed.data;
    await prisma.adminUser.create({
      data: { ...userData, passwordHash: await hashPassword(password) },
    });
    revalidatePath("/usuarios");
    return { success: "Usuario creado correctamente." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Ya existe un usuario con ese correo." };
    return { error: "No fue posible crear el usuario." };
  }
}

export async function setUserActive(_previous: UserActionState, formData: FormData): Promise<UserActionState> {
  await requireSuperadmin();
  const parsed = setUserActiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error.issues) };
  const result = await prisma.adminUser.updateMany({
    where: { id: parsed.data.id, role: { not: "SUPERADMIN" } },
    data: { active: parsed.data.active, sessionVersion: { increment: 1 } },
  });
  if (!result.count) return { error: "No se puede modificar ese usuario." };
  revalidatePath("/usuarios");
  return { success: parsed.data.active ? "Usuario activado." : "Usuario desactivado." };
}

export async function resetUserPassword(_previous: UserActionState, formData: FormData): Promise<UserActionState> {
  await requireSuperadmin();
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error.issues) };
  const result = await prisma.adminUser.updateMany({
    where: { id: parsed.data.id, role: { not: "SUPERADMIN" } },
    data: { passwordHash: await hashPassword(parsed.data.password), sessionVersion: { increment: 1 } },
  });
  if (!result.count) return { error: "No se puede modificar ese usuario." };
  return { success: "Contraseña restablecida." };
}
