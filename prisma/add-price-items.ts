// Tabela de preços fixos dos orçamentos: cria a tabela e os itens mais usados (valores em centavos).
// Pode rodar mais de uma vez: não duplica nem altera itens já cadastrados
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INITIAL = [
  { name: "Hemograma + coleta", price: 9000 },
  { name: "ALT", price: 3600 },
  { name: "Fosfatase alcalina", price: 3800 },
  { name: "Creatinina", price: 4000 },
  { name: "Ureia", price: 3800 },
  { name: "Consulta BIO CELL", price: 35000 },
];

async function main() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PriceItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PriceItem_pkey" PRIMARY KEY ("id")
  )`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PriceItem_name_key" ON "PriceItem"("name")`);
  const { count } = await prisma.priceItem.createMany({ data: INITIAL, skipDuplicates: true });
  console.log(`Tabela pronta; ${count} item(ns) incluído(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
