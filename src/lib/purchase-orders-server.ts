import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { seesAllUnits } from "./roles";
import { canViewPurchases } from "./purchase-orders";

// Saldo atual da unidade por produto (soma das movimentações de todos os lotes)
export async function unitStockByProduct(unitId: string) {
  const grouped = await prisma.inventoryTransaction.groupBy({ by: ["batchId"], where: { unitId }, _sum: { quantity: true } });
  const batches = await prisma.cellBatch.findMany({ where: { id: { in: grouped.map((g) => g.batchId) } }, select: { id: true, productId: true } });
  const productOf = new Map(batches.map((b) => [b.id, b.productId]));
  const stock: Record<string, number> = {};
  for (const g of grouped) {
    const pid = productOf.get(g.batchId);
    if (pid) stock[pid] = (stock[pid] || 0) + (g._sum.quantity || 0);
  }
  return stock;
}

export function canSeeUnit(session: SessionUser, unitId: string) {
  return seesAllUnits(session.role) || session.unitIds.includes(unitId);
}

export async function getAccessiblePurchaseOrder(session: SessionUser, id: string) {
  if (!canViewPurchases(session.role)) return { error: "Sem permissão", status: 403 } as const;
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } }, lines: { orderBy: { position: "asc" } } } });
  if (!order || !canSeeUnit(session, order.unitId)) return { error: "Pedido não encontrado", status: 404 } as const;
  return { order } as const;
}
