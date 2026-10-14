// Usuários: flag de senha provisória (troca obrigatória no próximo login)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false`);
  console.log("Coluna mustChangePassword garantida");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
