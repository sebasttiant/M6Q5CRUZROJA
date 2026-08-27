import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3536";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const CATEGORIES = ["MANO_DE_OBRA", "MEDICION", "METODO", "MATERIALES", "MAQUINARIA_EQUIPOS", "MEDIO_AMBIENTE"];

/** Server action ids live in the client chunk, next to the exported name that produced them. */
function findActionId(source, exportName) {
  const parts = source.split('createServerReference)("');
  for (let index = 1; index < parts.length; index += 1) {
    const id = parts[index].slice(0, parts[index].indexOf('"'));
    if (parts[index].slice(0, 400).includes(`"${exportName}"`)) return id;
  }
  return null;
}

let cachedActionId;
async function publicActionId() {
  if (cachedActionId) return cachedActionId;
  const html = await (await fetch(`${baseUrl}/reportes`)).text();
  const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[^"]+\.js/g) ?? [])];
  for (const chunk of chunks) {
    const id = findActionId(await (await fetch(`${baseUrl}${chunk}`)).text(), "createPublicAnalysis");
    if (id) return (cachedActionId = id);
  }
  throw new Error("createPublicAnalysis was not reachable from the public page bundle.");
}

/** Reproduces what the browser posts, so the server action is exercised end to end. */
async function submitPublicAnalysis(payload) {
  const response = await fetch(`${baseUrl}/reportes`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8", "Next-Action": await publicActionId(), "x-forwarded-for": payload.ip },
    body: JSON.stringify([payload.values]),
  });
  return { status: response.status, body: await response.text() };
}

const values = (finding, status = "EN_ANALISIS") => ({
  firstName: "Reporte", lastName: "Publico", email: "reporte.publico@example.org",
  process: "Pruebas", eventDate: new Date().toISOString().slice(0, 10), finding, status,
  categories: CATEGORIES.map((category) => ({
    category,
    subcauses: category === "METODO" ? [{ description: "Control previo ambiguo", impact: 3 }, { description: "Responsable no asignado", impact: 2 }] : [],
  })),
  mainCauses: [{ cause: "Método", subcause: "Control previo ambiguo", why1: "uno", why2: "dos", why3: "tres" }],
  rootCause: "Prueba de reporte publico",
});

async function main() {
  const suffix = randomBytes(6).toString("hex");
  const findings = [];
  try {
    // 1. The page is reachable with no session at all.
    const anonymous = await fetch(`${baseUrl}/reportes`, { redirect: "manual" });
    assert(anonymous.status === 200, `/reportes did not open anonymously (${anonymous.status}).`);
    const html = await anonymous.text();

    // 2. It exposes the four sections and none of the internal navigation.
    for (const section of ["Identificación del análisis", "Identificación de causas", "Causas principales", "Causa raíz final"]) {
      assert(html.includes(section), `Section missing on the public form: ${section}.`);
    }
    for (const leak of ['href="/dashboard"', 'href="/analisis"', 'href="/usuarios"', 'href="/analisis/nuevo"']) {
      assert(!html.includes(leak), `The public page links to an internal route: ${leak}.`);
    }
    assert(!html.includes(">Cerrado<"), "The public form offers the closed status.");

    // 3. A submission is stored with no creator and cannot arrive already closed.
    const finding = `Reporte publico ${suffix}`;
    findings.push(finding);
    const submitted = await submitPublicAnalysis({ ip: `203.0.113.${Math.floor(Math.random() * 250) + 1}`, values: values(finding, "CERRADO") });
    assert(submitted.status === 200, `The public submission failed (${submitted.status}).`);

    const stored = await prisma.analysis.findFirst({ where: { finding }, include: { categories: { include: { subcauses: true } }, mainCauses: true } });
    assert(stored, "The public submission was not stored.");
    assert(stored.creatorId === null, "The public submission recorded a creator.");
    assert(stored.status === "EN_ANALISIS", `A reporter forced the status to ${stored.status}.`);
    assert(/^M6Q5-\d{4}-\d{4}$/.test(stored.code), `Unexpected code format: ${stored.code}.`);
    assert(stored.categories.find((item) => item.category === "METODO")?.valuation === 6, "The 6M valuation was not applied.");
    assert(stored.mainCauses.length === 1, "The main cause was not stored.");

    // 4. The internal routes stay closed to the anonymous visitor.
    for (const route of ["/dashboard", "/analisis", "/analisis/nuevo", "/usuarios", `/analisis/${stored.id}`]) {
      const guarded = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
      assert(guarded.status === 307, `${route} answered ${guarded.status} without a session.`);
    }
    const exportResponse = await fetch(`${baseUrl}/api/export`, { redirect: "manual" });
    assert(exportResponse.status !== 200, `/api/export served data without a session (${exportResponse.status}).`);

    // 5. The rate limit closes the door on a burst from one address.
    const burstIp = "198.51.100.77";
    let blocked = false;
    for (let attempt = 1; attempt <= 21 && !blocked; attempt += 1) {
      const burstFinding = `Reporte rafaga ${suffix} ${attempt}`;
      const result = await submitPublicAnalysis({ ip: burstIp, values: values(burstFinding) });
      if (result.body.includes("límite de envíos")) blocked = true;
      else findings.push(burstFinding);
    }
    assert(blocked, "The rate limit never blocked a burst of 21 submissions from one address.");

    console.log("public report: anonymous access, no navigation leak, forced status, scoped storage and rate limit: ok");
  } finally {
    if (findings.length) await prisma.analysis.deleteMany({ where: { finding: { in: findings } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
