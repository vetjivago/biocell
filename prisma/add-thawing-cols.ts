import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Thawing" ADD COLUMN IF NOT EXISTS "thawedMeio" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Thawing" ADD COLUMN IF NOT EXISTS "thawedSoro" INTEGER`);
  console.log("Columns 'thawedMeio' and 'thawedSoro' ensured on Thawing");
}
main().catch(console.error).finally(() => prisma.$disconnect());
