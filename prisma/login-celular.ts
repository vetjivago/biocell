// Login por celular (rodar ANTES do deploy desta versão):
//  1. Coluna "phone" em User, única (só dígitos com DDD)
//  2. "email" deixa de ser obrigatório (o acesso pode ter só o celular)
// Uso: npx tsx prisma/login-celular.ts            (só mostra o que vai mudar)
//      npx tsx prisma/login-celular.ts --confirm  (aplica)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirm");

async function main() {
  const cols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string }[]>(
    `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'User' AND column_name IN ('email', 'phone')`
  );
  const hasPhone = cols.some((c) => c.column_name === "phone");
  const emailRequired = cols.some((c) => c.column_name === "email" && c.is_nullable === "NO");
  console.log(`1. Coluna User.phone: ${hasPhone ? "já existe" : "será criada (com índice único)"}`);
  console.log(`2. User.email: ${emailRequired ? "passa a ser opcional" : "já é opcional"}`);

  if (!confirm) {
    console.log("Nada alterado (rode com --confirm para aplicar).");
    return;
  }

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT`),
    prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")`),
    prisma.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL`),
  ]);
  console.log("Aplicado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
