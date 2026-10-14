// Padroniza o catálogo em 5 produtos (CTM CANINO/FELINO/EQUINO, SORO, MEIO), move todos os lotes para eles
// e junta lotes repetidos (mesmo número, só com espaços diferentes). Saldos e movimentações são preservados.
// Uso: npx tsx prisma/standardize-products.ts            (simulação: só mostra o que faria + backup)
//      npx tsx prisma/standardize-products.ts --confirm  (aplica)
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { STANDARD_PRODUCTS, normalizeBatchNumber, standardFor } from "../src/lib/products";

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirm");

async function main() {
  const products = await prisma.cellProduct.findMany({
    include: {
      batches: { include: { _count: { select: { inventoryTransactions: true, applicationItems: true, shipmentItems: true } } } },
    },
  });

  const dir = join(__dirname, "..", "..", "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `produtos-lotes-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(products, null, 2));
  console.log(`Backup: ${file}`);

  // Mapa produto antigo -> padrão
  const plan = new Map<string, string>();
  for (const p of products) {
    const std = STANDARD_PRODUCTS.some((s) => s.id === p.id) ? p : standardFor(p.category, p.species);
    if (!std) throw new Error(`Sem produto padrão para "${p.name}" (${p.category}/${p.species}) — ajuste antes`);
    plan.set(p.id, std.id);
  }

  // Agrupa lotes por (produto padrão, número normalizado); o canônico é o com mais movimentações
  const groups = new Map<string, { id: string; batchNumber: string; uses: number }[]>();
  for (const p of products) {
    for (const b of p.batches) {
      const key = `${plan.get(p.id)}|${normalizeBatchNumber(b.batchNumber)}`;
      const uses = b._count.inventoryTransactions + b._count.applicationItems + b._count.shipmentItems;
      groups.set(key, [...(groups.get(key) || []), { id: b.id, batchNumber: b.batchNumber, uses }]);
    }
  }

  for (const p of products) {
    const std = STANDARD_PRODUCTS.find((s) => s.id === plan.get(p.id))!;
    console.log(`${p.name.padEnd(40)} -> ${std.name} (${p.batches.length} lote(s))`);
  }
  const merges = [...groups.entries()].filter(([, list]) => list.length > 1);
  for (const [key, list] of merges) console.log(`  juntar ${list.length} lotes "${key.split("|")[1]}": ${list.map((l) => `${l.id}(${l.uses})`).join(", ")}`);

  if (!confirm) {
    console.log("\nSimulação: nada alterado. Rode com --confirm para aplicar.");
    return;
  }

  const balanceBefore = await prisma.inventoryTransaction.aggregate({ _sum: { quantity: true } });
  await prisma.$transaction(async (tx) => {
    for (const s of STANDARD_PRODUCTS) {
      await tx.cellProduct.upsert({
        where: { id: s.id },
        create: { id: s.id, name: s.name, code: s.code, category: s.category, species: s.species, active: true },
        update: { name: s.name, code: s.code, category: s.category, species: s.species, active: true },
      });
    }
    for (const [key, list] of groups) {
      const [productId, number] = key.split("|");
      const [canonical, ...dups] = [...list].sort((a, b) => b.uses - a.uses);
      for (const d of dups) {
        await tx.inventoryTransaction.updateMany({ where: { batchId: d.id }, data: { batchId: canonical.id } });
        await tx.applicationItem.updateMany({ where: { batchId: d.id }, data: { batchId: canonical.id } });
        await tx.shipmentItem.updateMany({ where: { batchId: d.id }, data: { batchId: canonical.id } });
        await tx.cellBatch.delete({ where: { id: d.id } });
      }
      await tx.cellBatch.update({ where: { id: canonical.id }, data: { productId, batchNumber: number } });
    }
    // Produtos antigos ficam sem lotes: removidos para não aparecerem mais
    const oldIds = products.map((p) => p.id).filter((id) => !STANDARD_PRODUCTS.some((s) => s.id === id));
    await tx.cellProduct.deleteMany({ where: { id: { in: oldIds } } });
  }, { timeout: 60_000 });

  const balanceAfter = await prisma.inventoryTransaction.aggregate({ _sum: { quantity: true } });
  console.log("\nAplicado. Saldo total antes/depois:", balanceBefore._sum.quantity, "/", balanceAfter._sum.quantity);
  console.log("Produtos agora:", (await prisma.cellProduct.findMany({ select: { name: true }, orderBy: { name: "asc" } })).map((p) => p.name));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
