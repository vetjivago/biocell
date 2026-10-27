// Prontuário: responsável pelo preparo em cada aplicação e fotos das palhetas
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "preparedBy" TEXT`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MedicalRecordAttachment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "medicalRecordId" TEXT NOT NULL REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "data" BYTEA NOT NULL,
      "uploadedById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MedicalRecordAttachment_medicalRecordId_idx" ON "MedicalRecordAttachment"("medicalRecordId")`);
  console.log("Coluna preparedBy e tabela de fotos das palhetas garantidas");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
