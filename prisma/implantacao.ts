// Preparação para o uso real (rodar ANTES do deploy desta versão):
//  1. Coluna "deletedAt" em User (exclusão de usuários)
//  2. Matriz em Brasília/DF
//  3. Prontuários CT antigos renumerados no padrão sequencial 001/26, 002/26...
//  4. Estoque zerado em todas as unidades, menos a UABC Águas Claras (com backup em JSON)
// Uso: npx tsx prisma/implantacao.ts            (só mostra o que vai mudar + backup)
//      npx tsx prisma/implantacao.ts --confirm  (aplica)
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirm");
const KEEP_UNIT_ID = "unit_03"; // UABC Águas Claras

const SERIAL = /^(\d+)\/(\d{2})$/;
const fmt = (seq: number, yy: string) => `${String(seq).padStart(3, "0")}/${yy}`;

async function main() {
  // 1. Coluna nova
  if (confirm) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`);
    console.log("1. Coluna User.deletedAt garantida");
  } else {
    console.log("1. Coluna User.deletedAt será criada");
  }

  // 2. Matriz
  const matriz = await prisma.unit.findFirst({ where: { OR: [{ id: "unit_matriz" }, { name: { contains: "MATRIZ", mode: "insensitive" } }] } });
  if (!matriz) throw new Error("Unidade matriz não encontrada");
  console.log(`2. ${matriz.name}: ${matriz.city}/${matriz.state} → Brasília/DF`);
  if (confirm) await prisma.unit.update({ where: { id: matriz.id }, data: { city: "Brasília", state: "DF" } });

  // 3. Renumeração: só prontuários fora do padrão, na ordem de criação, depois do maior número do ano
  const records = await prisma.medicalRecord.findMany({ select: { id: true, serialNumber: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const maxByYear = new Map<string, number>();
  for (const r of records) {
    const m = SERIAL.exec(r.serialNumber);
    if (m) maxByYear.set(m[2], Math.max(maxByYear.get(m[2]) || 0, Number(m[1])));
  }
  const renames: { id: string; from: string; to: string }[] = [];
  for (const r of records) {
    if (SERIAL.test(r.serialNumber)) continue;
    const yy = String(r.createdAt.getFullYear() % 100).padStart(2, "0");
    const next = (maxByYear.get(yy) || 0) + 1;
    maxByYear.set(yy, next);
    renames.push({ id: r.id, from: r.serialNumber, to: fmt(next, yy) });
  }
  console.log(`3. Prontuários a renumerar: ${renames.length}`);
  for (const r of renames) console.log(`   ${r.from} → ${r.to}`);

  // 4. Estoque
  const keep = await prisma.unit.findUnique({ where: { id: KEEP_UNIT_ID } });
  if (!keep || !keep.name.toUpperCase().includes("CLARAS")) throw new Error(`Unidade ${KEEP_UNIT_ID} não é Águas Claras`);
  const where = { unitId: { not: KEEP_UNIT_ID } };
  const transactions = await prisma.inventoryTransaction.findMany({ where, include: { unit: { select: { name: true } } } });
  const alerts = await prisma.alert.findMany({ where: { ...where, type: "LOW_STOCK" } });
  const perUnit = new Map<string, number>();
  for (const t of transactions) perUnit.set(t.unit.name, (perUnit.get(t.unit.name) || 0) + t.quantity);
  console.log(`4. Estoque zerado (mantém ${keep.name}): ${transactions.length} movimentações, ${alerts.length} alertas`);
  for (const [name, qty] of perUnit) console.log(`   ${name}: ${qty} → 0`);

  const dir = join(__dirname, "..", "..", "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `implantacao-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ matriz, renames, inventoryTransactions: transactions, alerts }, null, 2));
  console.log(`Backup salvo em ${file}`);

  if (!confirm) {
    console.log("Nada alterado (rode com --confirm para aplicar).");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Em duas etapas para não colidir com o índice único durante a troca
    for (const r of renames) await tx.medicalRecord.update({ where: { id: r.id }, data: { serialNumber: `tmp-${r.id}` } });
    for (const r of renames) await tx.medicalRecord.update({ where: { id: r.id }, data: { serialNumber: r.to } });
    await tx.inventoryTransaction.deleteMany({ where });
    await tx.alert.deleteMany({ where: { ...where, type: "LOW_STOCK" } });
  });
  console.log("Aplicado. Estoque restante fora de Águas Claras:", await prisma.inventoryTransaction.count({ where }));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
