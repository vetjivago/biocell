// Prontuário clínico geral: cria as tabelas (idempotente) e habilita para a UABC Águas Claras
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const statements = [
  `ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "generalRecordEnabled" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS "ClinicalEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "weight" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClinicalEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClinicalEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClinicalEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClinicalEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ClinicalAttachment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicalAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClinicalAttachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ClinicalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ClinicalEntry_patientId_occurredAt_idx" ON "ClinicalEntry"("patientId", "occurredAt")`,
  `CREATE INDEX IF NOT EXISTS "ClinicalEntry_unitId_idx" ON "ClinicalEntry"("unitId")`,
  `CREATE INDEX IF NOT EXISTS "ClinicalAttachment_entryId_idx" ON "ClinicalAttachment"("entryId")`,
];

async function main() {
  for (const sql of statements) await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRawUnsafe(`UPDATE "Unit" SET "generalRecordEnabled" = true WHERE "id" = 'unit_03'`);
  const enabled = await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT "name" FROM "Unit" WHERE "generalRecordEnabled" = true`);
  console.log("Prontuário geral habilitado em:", enabled.map((u) => u.name));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
