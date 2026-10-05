import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "CellProduct" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'CELULAS'`);
  console.log("Column 'category' ensured on CellProduct");
  const products: { id: string; name: string; category: string }[] = await prisma.$queryRawUnsafe(`SELECT id, name, category FROM "CellProduct"`);
  console.log("Products:", products);
}
main().catch(console.error).finally(() => prisma.$disconnect());
