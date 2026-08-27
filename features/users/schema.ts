import { z } from "zod";

export const MANAGEABLE_ROLE = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export const emailSchema = z.string().trim().toLowerCase().email("Ingrese un correo válido.").max(254, "El correo es demasiado largo.");
export const passwordSchema = z.string().min(12, "La contraseña debe tener al menos 12 caracteres.").max(128, "La contraseña es demasiado larga.");

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum([MANAGEABLE_ROLE.ADMIN, MANAGEABLE_ROLE.USER]),
});

export const userIdSchema = z.string().cuid("Usuario inválido.");
export const setUserActiveSchema = z.object({
  id: userIdSchema,
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const resetPasswordSchema = z.object({ id: userIdSchema, password: passwordSchema });
