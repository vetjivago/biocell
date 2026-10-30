// Unidades: dados cadastrais (CNPJ, razão social, endereço completo, contatos de faturamento/financeiro)
// e documentos com anexos (Cartão CNPJ, Contrato Social, Contrato UABC e outros).
// Só acrescenta colunas/tabelas (não apaga nada) e pode ser rodado mais de uma vez.
// Antes de alterar, salva uma cópia da tabela "Unit" em Hilana/backups/unidades-<data>.json
// (o backup completo, prisma/backup.ts, já usa o schema novo e só funciona depois desta migração).
// Uso: npx tsx prisma/add-unit-registry.ts
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  // 1. Backup da tabela que será alterada
  const units = await prisma.$queryRawUnsafe<object[]>(`SELECT * FROM "Unit" ORDER BY "createdAt"`);
  const dir = join(__dirname, "..", "..", "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `unidades-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(units, null, 2));
  console.log(`Backup de ${units.length} unidades salvo em ${file}`);

  // 2. Novas colunas da unidade
  const columns = [
    `"inactivatedAt" TIMESTAMP(3)`,
    `"cnpj" TEXT`, `"legalName" TEXT`, `"tradeName" TEXT`, `"legalNature" TEXT`, `"legalCategory" TEXT`,
    `"stateRegistration" TEXT`, `"shareCapital" DECIMAL(15,2)`,
    `"zipCode" TEXT`, `"street" TEXT`, `"number" TEXT`, `"complement" TEXT`, `"district" TEXT`,
    `"phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`, `"mobiles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
    `"emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`, `"billingEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
    `"financeEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  ];
  for (const c of columns) await prisma.$executeRawUnsafe(`ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS ${c}`);

  // 3. Documentos e anexos
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UnitDocument" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "unitId" TEXT NOT NULL REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "kind" TEXT NOT NULL DEFAULT 'OTHER',
      "name" TEXT NOT NULL,
      "notes" TEXT,
      "dueDate" TIMESTAMP(3),
      "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UnitDocument_unitId_idx" ON "UnitDocument"("unitId")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UnitDocumentAttachment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "documentId" TEXT NOT NULL REFERENCES "UnitDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "data" BYTEA NOT NULL,
      "uploadedById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UnitDocumentAttachment_documentId_idx" ON "UnitDocumentAttachment"("documentId")`);

  // 4. Documentos padrão em todas as unidades (sem anexos; o administrativo anexa depois)
  const defaults = [["CNPJ_CARD", "Cartão CNPJ"], ["SOCIAL_CONTRACT", "Contrato Social"], ["UABC_CONTRACT", "Contrato UABC"]];
  for (const [kind, name] of defaults) {
    const n = await prisma.$executeRawUnsafe(
      `INSERT INTO "UnitDocument" ("id", "unitId", "kind", "name")
       SELECT 'ud' || replace(gen_random_uuid()::text, '-', ''), u."id", $1, $2 FROM "Unit" u
       WHERE NOT EXISTS (SELECT 1 FROM "UnitDocument" d WHERE d."unitId" = u."id" AND d."kind" = $1)`,
      kind, name,
    );
    console.log(`${name}: criado em ${n} unidade(s)`);
  }

  // 5. Telefone antigo (campo único) vai para a lista: 11 dígitos = celular, senão telefone
  const phones = await prisma.$executeRawUnsafe(`
    UPDATE "Unit" SET
      "mobiles" = CASE WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 11 THEN ARRAY["phone"] ELSE "mobiles" END,
      "phones"  = CASE WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 11 THEN "phones" ELSE ARRAY["phone"] END
    WHERE "phone" IS NOT NULL AND "phone" <> '' AND cardinality("phones") = 0 AND cardinality("mobiles") = 0`);
  console.log(`Telefone antigo copiado para a lista em ${phones} unidade(s)`);

  console.log("Dados cadastrais e documentos das unidades garantidos");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
