import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
});

export function getConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Configuración incompleta: DATABASE_URL y SESSION_SECRET son obligatorios.");
  return { databaseUrl: parsed.data.DATABASE_URL, sessionSecret: parsed.data.SESSION_SECRET };
}
