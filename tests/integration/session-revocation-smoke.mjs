import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const scrypt = promisify(scryptCallback);
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3536";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function login(email, password) {
  const loginPage = await fetch(`${baseUrl}/login`);
  const html = await loginPage.text();
  const hiddenInputs = Array.from(html.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g));
  assert(hiddenInputs.length, "Login action was not found.");
  const body = new FormData();
  for (const input of hiddenInputs) body.append(input[1], (input[2] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  body.append("email", email);
  body.append("password", password);
  const response = await fetch(`${baseUrl}/login`, { method: "POST", body, redirect: "manual" });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert(response.status === 303 && cookie, `Login failed (${response.status}).`);
  return cookie;
}

async function dashboard(cookie) {
  return fetch(`${baseUrl}/dashboard`, { headers: { cookie }, redirect: "manual" });
}

async function main() {
  const suffix = randomBytes(6).toString("hex");
  const email = `smoke-session-${suffix}@example.org`;
  const originalPassword = randomBytes(18).toString("base64url");
  const resetPassword = randomBytes(18).toString("base64url");
  let user;

  try {
    user = await prisma.adminUser.create({
      data: { email, passwordHash: await hashPassword(originalPassword), role: "USER" },
    });
    const oldSession = await login(email, originalPassword);
    assert((await dashboard(oldSession)).status === 200, "Initial session was not authorized.");

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(resetPassword), sessionVersion: { increment: 1 } },
    });
    assert((await dashboard(oldSession)).status === 307, "old_session remained authorized after password reset.");

    const resetSession = await login(email, resetPassword);
    assert((await dashboard(resetSession)).status === 200, "New session was not authorized after password reset.");

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { active: false, sessionVersion: { increment: 1 } },
    });
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { active: true, sessionVersion: { increment: 1 } },
    });
    assert((await dashboard(resetSession)).status === 307, "A session issued before deactivation revived after reactivation.");
    console.log("old_session/password-reset/deactivation/reactivation smoke: ok");
  } finally {
    if (user) await prisma.adminUser.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
