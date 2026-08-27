import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const scrypt = promisify(scryptCallback);
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
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
  assert(hiddenInputs.length, "No se encontró la acción de inicio de sesión.");
  const body = new FormData();
  for (const input of hiddenInputs) body.append(input[1], (input[2] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  body.append("email", email);
  body.append("password", password);
  const response = await fetch(`${baseUrl}/login`, { method: "POST", body, redirect: "manual" });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert(response.status === 303 && cookie, `Falló el inicio de sesión para el rol probado (${response.status}).`);
  return cookie;
}

async function get(path, cookie) {
  return fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: "manual" });
}

async function main() {
  const suffix = randomBytes(6).toString("hex");
  const adminEmail = `smoke-admin-${suffix}@example.org`;
  const userEmail = `smoke-user-${suffix}@example.org`;
  const adminPassword = randomBytes(18).toString("base64url");
  const userPassword = randomBytes(18).toString("base64url");
  let admin;
  let user;
  try {
    const superCookie = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
    assert((await get("/usuarios", superCookie)).status === 200, "SUPERADMIN no pudo abrir usuarios.");

    admin = await prisma.adminUser.create({ data: { email: adminEmail, passwordHash: await hashPassword(adminPassword), role: "ADMIN" } });
    user = await prisma.adminUser.create({ data: { email: userEmail, passwordHash: await hashPassword(userPassword), role: "USER" } });
    const adminAnalysis = await prisma.analysis.create({ data: { code: `SMOKE-A-${suffix}`, firstName: "Prueba", lastName: "Admin", email: adminEmail, process: "Pruebas", eventDate: new Date(), finding: "Control de alcance administrador", rootCause: "Prueba temporal", creatorId: admin.id } });
    const userAnalysis = await prisma.analysis.create({ data: { code: `SMOKE-U-${suffix}`, firstName: "Prueba", lastName: "Usuario", email: userEmail, process: "Pruebas", eventDate: new Date(), finding: "Control de alcance usuario", rootCause: "Prueba temporal", creatorId: user.id } });

    const adminCookie = await login(adminEmail, adminPassword);
    assert((await get("/usuarios", adminCookie)).status === 307, "ADMIN pudo abrir usuarios.");
    assert((await get(`/analisis/${userAnalysis.id}`, adminCookie)).status === 200, "ADMIN no pudo consultar un análisis institucional.");

    const userCookie = await login(userEmail, userPassword);
    assert((await get("/usuarios", userCookie)).status === 307, "USER pudo abrir usuarios.");
    assert((await get(`/analisis/${userAnalysis.id}`, userCookie)).status === 200, "USER no pudo consultar su análisis.");
    assert((await get(`/analisis/${adminAnalysis.id}`, userCookie)).status === 404, "USER pudo consultar un análisis ajeno.");
    assert((await get("/api/export", userCookie)).status === 200, "La exportación autorizada de USER falló.");

    await prisma.adminUser.update({ where: { id: user.id }, data: { active: false } });
    assert((await get("/dashboard", userCookie)).status === 307, "Una sesión existente siguió autorizada después de desactivar al usuario.");
    console.log("roles/login/scope/export/deactivation smoke: ok");
  } finally {
    if (admin || user) await prisma.analysis.deleteMany({ where: { creatorId: { in: [admin?.id, user?.id].filter(Boolean) } } });
    if (admin || user) await prisma.adminUser.deleteMany({ where: { id: { in: [admin?.id, user?.id].filter(Boolean) } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
