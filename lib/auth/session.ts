import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "./password";

const COOKIE_NAME = "m6q5_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

function sign(value: string): string {
  return createHmac("sha256", getConfig().sessionSecret).update(value).digest("hex");
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + SESSION_DURATION_SECONDS;
  const payload = `v1.${Buffer.from(userId).toString("base64url")}.${issuedAt}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(raw?: string, now = Date.now()): string | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return null;
  const [version, encodedId, issuedAtRaw, expiresAtRaw, signatureRaw] = parts;
  const payload = `${version}.${encodedId}.${issuedAtRaw}.${expiresAtRaw}`;
  const signature = Buffer.from(signatureRaw, "hex");
  const expected = Buffer.from(sign(payload), "hex");
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  const currentTime = Math.floor(now / 1000);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) || issuedAt > currentTime || expiresAt <= issuedAt || currentTime >= expiresAt) return null;
  const userId = Buffer.from(encodedId, "base64url").toString();
  return userId || null;
}

export async function getSessionUser() {
  const userId = verifySessionToken((await cookies()).get(COOKIE_NAME)?.value);
  if (!userId) return null;
  return prisma.adminUser.findFirst({ where: { id: userId, active: true }, select: { id: true, email: true } });
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function createSession(email: string, password: string): Promise<boolean> {
  const user = await prisma.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.active || !(await verifyPassword(password, user.passwordHash))) return false;
  (await cookies()).set(COOKIE_NAME, createSessionToken(user.id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DURATION_SECONDS,
  });
  return true;
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
