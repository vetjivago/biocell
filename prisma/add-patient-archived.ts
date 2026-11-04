// Paciente oculto pela matriz: coluna nova "archivedAt". Pode rodar mais de uma vez
// (roda também no build da Vercel, antes do next build)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`);
  console.log("Coluna Patient.archivedAt pronta");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
