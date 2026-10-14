// Dados completos do paciente (sexo, pelagem, nascimento, microchip, foto) e campos extras do prontuário geral
// SQL gerado por `prisma migrate diff` (add-patient-details.sql); só roda se ainda não foi aplicado
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const [{ exists }] = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass('"PatientPhoto"') IS NOT NULL AS "exists"`
  );
  if (exists) return console.log("Já aplicado");
  const sql = readFileSync(join(__dirname, "add-patient-details.sql"), "utf-8");
  const statements = sql.split(/;\s*$/m).map((s) => s.replace(/^--.*$/gm, "").trim()).filter(Boolean);
  await prisma.$transaction(statements.map((s) => prisma.$executeRawUnsafe(s)));
  console.log(`${statements.length} comandos aplicados`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
