import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("[seed] ADMIN_EMAIL/ADMIN_PASSWORD no definidos; no se crea usuario.");
    return;
  }
  if (password.length < 12) throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (!existing) await prisma.adminUser.create({ data: { email, passwordHash: await hashPassword(password) } });
}

async function seedDemo() {
  const code = "M6Q5-0001-2026";
  await prisma.annualSequence.upsert({ where: { year: 2026 }, create: { year: 2026, lastValue: 1 }, update: {} });
  await prisma.analysis.upsert({
    where: { code }, update: {},
    create: {
      code, firstName: "María", lastName: "Restrepo", email: "maria.restrepo@example.org", process: "Gestión del riesgo",
      eventDate: new Date("2026-08-18T00:00:00.000Z"), finding: "La revisión del alistamiento evidenció una verificación incompleta de elementos críticos.",
      status: "EN_ANALISIS", rootCause: "El procedimiento no define un punto de control verificable antes de la salida operativa.",
      categories: { create: [
        { category: "MANO_DE_OBRA", valuation: 2, subcauses: { create: [{ description: "Inducción no verificada", impact: 2 }] } },
        { category: "MEDICION", valuation: 3, subcauses: { create: [{ description: "Lista de chequeo sin indicador", impact: 3 }] } },
        { category: "METODO", valuation: 6, subcauses: { create: [{ description: "Control previo ambiguo", impact: 3 }, { description: "Responsable no asignado", impact: 2 }] } },
        { category: "MATERIALES", valuation: 0 }, { category: "MAQUINARIA_EQUIPOS", valuation: 0 }, { category: "MEDIO_AMBIENTE", valuation: 1, subcauses: { create: [{ description: "Presión por tiempo", impact: 1 }] } },
      ] },
      mainCauses: { create: [{ position: 1, cause: "Verificación incompleta", subcause: "Control previo ambiguo", why1: "No se revisaron todos los elementos", why2: "La lista no exigía confirmación individual", why3: "El procedimiento agrupaba controles distintos", why4: "No se había revisado el riesgo del alistamiento", why5: "No existe un dueño formal del punto de control" }] },
    },
  });
}

async function main() {
  await seedAdmin();
  if (process.env.SEED_DEMO === "true") await seedDemo();
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
