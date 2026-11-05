// Ajustes no banco que rodam no build da Vercel, antes do next build.
// - Colunas novas: idempotentes (ADD COLUMN IF NOT EXISTS), podem rodar sempre.
// - Ajustes de dados: rodam UMA vez; ficam marcados na tabela AppMigration, para que uma
//   mudança feita depois pela tela (ex.: desligar a OS de uma unidade) não seja desfeita.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function once(name: string, run: () => Promise<string>) {
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT INTO "AppMigration" ("name") VALUES ($1) ON CONFLICT ("name") DO NOTHING`,
    name,
  );
  if (!inserted) return console.log(`[${name}] já aplicado`);
  console.log(`[${name}] ${await run()}`);
}

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "AppMigration" ("name" TEXT PRIMARY KEY, "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );

  // Nov/2026: abertura de OS liberada para os veterinários clínicos de todas as UABCs
  await once("2026-11-os-todas-unidades", async () => {
    const r = await prisma.unit.updateMany({ where: { serviceOrderEnabled: false }, data: { serviceOrderEnabled: true } });
    return `ordem de serviço habilitada em ${r.count} unidade(s)`;
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
