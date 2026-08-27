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
  return `${salt.toString("hex")}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}

async function login(email, password) {
  const html = await (await fetch(`${baseUrl}/login`)).text();
  const hidden = Array.from(html.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g));
  const body = new FormData();
  for (const input of hidden) body.append(input[1], (input[2] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  body.append("email", email);
  body.append("password", password);
  const response = await fetch(`${baseUrl}/login`, { method: "POST", body, redirect: "manual" });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert(response.status === 303 && cookie, `Login failed (${response.status}).`);
  return cookie;
}

const downloadPdf = (id, cookie) =>
  fetch(`${baseUrl}/api/export/pdf?id=${id}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });

async function main() {
  const suffix = randomBytes(6).toString("hex");
  let owner;
  let outsider;
  let analysis;
  try {
    const superCookie = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

    const ownerPassword = randomBytes(18).toString("base64url");
    const outsiderPassword = randomBytes(18).toString("base64url");
    owner = await prisma.adminUser.create({ data: { email: `pdf-owner-${suffix}@example.org`, passwordHash: await hashPassword(ownerPassword), role: "USER" } });
    outsider = await prisma.adminUser.create({ data: { email: `pdf-outsider-${suffix}@example.org`, passwordHash: await hashPassword(outsiderPassword), role: "USER" } });

    analysis = await prisma.analysis.create({
      data: {
        code: `PDF-${suffix}`, firstName: "Prueba", lastName: "PDF", email: "prueba.pdf@example.org",
        process: "Pruebas", eventDate: new Date(), finding: "Hallazgo para exportación PDF", rootCause: "Causa raíz de prueba",
        creatorId: owner.id,
        categories: { create: [{ category: "METODO", valuation: 6, subcauses: { create: [{ description: "Control previo ambiguo", impact: 3 }, { description: "Responsable no asignado", impact: 2 }] } }] },
        mainCauses: { create: [{ position: 1, cause: "Método", subcause: "Control previo ambiguo", why1: "uno", why2: "dos", why3: "tres" }] },
      },
    });

    // 1. An anonymous caller gets nothing.
    assert((await downloadPdf(analysis.id, null)).status === 401, "The PDF endpoint answered without a session.");

    // 2. The owner downloads a real PDF, produced inside the container.
    const ownerResponse = await downloadPdf(analysis.id, await login(owner.email, ownerPassword));
    assert(ownerResponse.status === 200, `The owner could not download the PDF (${ownerResponse.status}).`);
    assert(ownerResponse.headers.get("content-type") === "application/pdf", `Unexpected content type: ${ownerResponse.headers.get("content-type")}.`);
    assert(ownerResponse.headers.get("content-disposition")?.includes(`${analysis.code}.pdf`), "The download is not named after the institutional code.");
    const bytes = Buffer.from(await ownerResponse.arrayBuffer());
    assert(bytes.subarray(0, 5).toString() === "%PDF-", "The response is not a PDF document.");
    assert(bytes.subarray(-8).toString().includes("%%EOF"), "The PDF is truncated.");
    assert(bytes.byteLength > 3000, `The PDF looks empty (${bytes.byteLength} bytes).`);
    const pages = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    assert(pages >= 1 && pages <= 4, `Unexpected page count: ${pages}.`);
    assert(bytes.includes(Buffer.from(analysis.code, "utf16le").swap16()), "The institutional code is missing from the metadata.");

    // 3. Another USER must not reach an analysis that is not theirs.
    assert((await downloadPdf(analysis.id, await login(outsider.email, outsiderPassword))).status === 404, "A USER exported an analysis belonging to someone else.");

    // 4. SUPERADMIN keeps the institutional view.
    assert((await downloadPdf(analysis.id, superCookie)).status === 200, "SUPERADMIN could not export the analysis.");

    // 5. A missing identifier is rejected cleanly.
    assert((await fetch(`${baseUrl}/api/export/pdf`, { headers: { cookie: superCookie } })).status === 400, "The endpoint accepted a request with no identifier.");

    console.log(`pdf export: auth, ownership scope, ${pages}-page document and metadata: ok`);
  } finally {
    if (analysis) await prisma.analysis.deleteMany({ where: { id: analysis.id } });
    const ids = [owner?.id, outsider?.id].filter(Boolean);
    if (ids.length) await prisma.adminUser.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
