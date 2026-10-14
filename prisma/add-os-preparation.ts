// OS: via de aplicação, quantidade de células e forma de preparo por aplicação
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  for (const col of ["applicationRoute", "cellQuantity", "preparation"]) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceOrderApplication" ADD COLUMN IF NOT EXISTS "${col}" TEXT`);
  }
  console.log("Colunas de preparo garantidas na OS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
