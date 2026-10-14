// Ordem de serviço (preparo das células): cria as tabelas e habilita para a UABC Águas Claras
// SQL gerado por `prisma migrate diff` (add-service-orders.sql); só roda se as tabelas não existirem
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const [{ exists }] = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass('"ServiceOrder"') IS NOT NULL AS "exists"`
  );
  if (!exists) {
    const sql = readFileSync(join(__dirname, "add-service-orders.sql"), "utf-8");
    const statements = sql.split(/;\s*$/m).map((s) => s.replace(/^--.*$/gm, "").trim()).filter(Boolean);
    await prisma.$transaction(statements.map((s) => prisma.$executeRawUnsafe(s)));
    console.log(`${statements.length} comandos aplicados`);
  } else {
    console.log("Tabelas já existem");
  }
  await prisma.$executeRawUnsafe(`UPDATE "Unit" SET "serviceOrderEnabled" = true WHERE "id" = 'unit_03'`);
  const enabled = await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT "name" FROM "Unit" WHERE "serviceOrderEnabled" = true`);
  console.log("OS habilitada em:", enabled.map((u) => u.name));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
