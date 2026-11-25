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

// O repositório é público: o build da Vercel não segue sem um segredo de sessão próprio
function checkSessionSecret() {
  if (!process.env.VERCEL) return;
  const value = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "";
  const known = ["biocell-dev-secret", "gere-uma-string-aleatoria-de-64-caracteres"];
  if (value.length < 32 || known.includes(value)) {
    throw new Error("Configure JWT_SECRET na Vercel (Settings → Environment Variables) com uma string aleatória de 32+ caracteres");
  }
  console.log("[segurança] JWT_SECRET configurado");
}

async function main() {
  checkSessionSecret();
  await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "AppMigration" ("name" TEXT PRIMARY KEY, "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );

  // Nov/2026: baixa por perda (palheta estourada/quebrada) com foto
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InventoryLossPhoto" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "transactionId" TEXT NOT NULL REFERENCES "InventoryTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "data" BYTEA NOT NULL,
      "uploadedById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryLossPhoto_transactionId_idx" ON "InventoryLossPhoto"("transactionId")`);

  // Nov/2026: pedidos de compra das UABCs (no lugar da loja do Sults)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "number" SERIAL NOT NULL,
      "unitId" TEXT NOT NULL REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      "createdById" TEXT NOT NULL,
      "createdByName" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'WAITING',
      "racksCanine" INTEGER NOT NULL DEFAULT 0,
      "racksFeline" INTEGER NOT NULL DEFAULT 0,
      "racksEquine" INTEGER NOT NULL DEFAULT 0,
      "notes" TEXT,
      "dryIce" BOOLEAN NOT NULL DEFAULT false,
      "dryIceQty" INTEGER NOT NULL DEFAULT 0,
      "shippingMode" TEXT,
      "carrier" TEXT,
      "freight" INTEGER NOT NULL DEFAULT 0,
      "extraValue" INTEGER NOT NULL DEFAULT 0,
      "discount" INTEGER NOT NULL DEFAULT 0,
      "paymentMethod" TEXT,
      "installments" TEXT,
      "adminNotes" TEXT,
      "invoicedAt" TIMESTAMP(3),
      "shippedAt" TIMESTAMP(3),
      "shippedBy" TEXT,
      "deliveredAt" TIMESTAMP(3),
      "cancelledAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_number_key" ON "PurchaseOrder"("number")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PurchaseOrder_unitId_idx" ON "PurchaseOrder"("unitId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_idx" ON "PurchaseOrder"("status")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderId" TEXT NOT NULL REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "productId" TEXT NOT NULL,
      "position" INTEGER NOT NULL,
      "stockQty" INTEGER NOT NULL DEFAULT 0,
      "calculated" INTEGER NOT NULL DEFAULT 0,
      "extra" INTEGER NOT NULL DEFAULT 0,
      "quantity" INTEGER NOT NULL DEFAULT 0,
      "lots" JSONB
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_orderId_idx" ON "PurchaseOrderItem"("orderId")`);
  // Nov/2026: loja (carrinho) no lugar do formulário — linhas compradas, com o preço do dia
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PurchaseOrderLine" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderId" TEXT NOT NULL REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "position" INTEGER NOT NULL,
      "storeId" TEXT NOT NULL,
      "variant" TEXT,
      "name" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "unitPrice" INTEGER NOT NULL
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PurchaseOrderLine_orderId_idx" ON "PurchaseOrderLine"("orderId")`);

  // Nov/2026: abertura de OS liberada para os veterinários clínicos de todas as UABCs
  await once("2026-11-os-todas-unidades", async () => {
    const r = await prisma.unit.updateMany({ where: { serviceOrderEnabled: false }, data: { serviceOrderEnabled: true } });
    return `ordem de serviço habilitada em ${r.count} unidade(s)`;
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
