import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ApplicationItem" (
      "id" TEXT NOT NULL,
      "applicationId" TEXT NOT NULL,
      "batchId" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      CONSTRAINT "ApplicationItem_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "ApplicationItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ApplicationItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CellBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ApplicationItem_applicationId_idx" ON "ApplicationItem"("applicationId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ApplicationItem_batchId_idx" ON "ApplicationItem"("batchId")`);
  console.log("Table 'ApplicationItem' ensured");
}
main().catch(console.error).finally(() => prisma.$disconnect());
