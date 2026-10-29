// CPF do tutor (para faturar): coluna nova no paciente. Pode rodar mais de uma vez
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "ownerCpf" TEXT`);
  console.log("Coluna ownerCpf pronta");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
