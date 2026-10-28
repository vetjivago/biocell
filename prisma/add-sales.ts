// Orçamentos e vendas: cria as tabelas (usam o mesmo "habilitado" do prontuário geral da unidade)
// SQL gerado por `prisma migrate diff` (add-sales.sql); só roda se as tabelas não existirem
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const [{ exists }] = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass('"Sale"') IS NOT NULL AS "exists"`
  );
  if (exists) {
    console.log("Tabelas já existem");
    return;
  }
  const sql = readFileSync(join(__dirname, "add-sales.sql"), "utf-8");
  const statements = sql.split(/;\s*$/m).map((s) => s.replace(/^--.*$/gm, "").trim()).filter(Boolean);
  await prisma.$transaction(statements.map((s) => prisma.$executeRawUnsafe(s)));
  console.log(`${statements.length} comandos aplicados`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
