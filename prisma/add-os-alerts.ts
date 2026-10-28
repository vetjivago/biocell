// "Concluir OS": data em que o veterinário avisou o laboratório e vínculo do alerta com a OS.
// Colunas opcionais; pode rodar mais de uma vez
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceOrderApplication" ADD COLUMN IF NOT EXISTS "sentToLabAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "serviceOrderId" TEXT`);
  console.log("Colunas aplicadas");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
