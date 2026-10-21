import { prisma } from "./prisma";

const DEFAULT_MIN_STRAWS = 15;

// Recalcula o alerta de estoque baixo (células) a partir do saldo real da unidade:
// abre se estiver no mínimo ou abaixo, atualiza a mensagem com o saldo atual e resolve quando repõe
export async function syncLowStockAlert(unitId: string) {
  const [total, threshold, open] = await Promise.all([
    prisma.inventoryTransaction.aggregate({
      where: { unitId, batch: { product: { category: "CELULAS" } } },
      _sum: { quantity: true },
    }),
    prisma.stockThreshold.findFirst({ where: { unitId } }),
    prisma.alert.findMany({ where: { unitId, type: "LOW_STOCK", resolved: false }, orderBy: { createdAt: "asc" } }),
  ]);
  const balance = total._sum.quantity || 0;
  const minStraws = threshold?.minimumStraws ?? DEFAULT_MIN_STRAWS;

  if (balance > minStraws) {
    if (open.length) await prisma.alert.updateMany({ where: { id: { in: open.map((a) => a.id) } }, data: { resolved: true } });
    return;
  }
  const message = `Estoque baixo de células: ${balance} palhetas restantes (mínimo: ${minStraws})`;
  if (open.length === 0) {
    await prisma.alert.create({ data: { unitId, type: "LOW_STOCK", message } });
    return;
  }
  if (open[0].message !== message) await prisma.alert.update({ where: { id: open[0].id }, data: { message } });
  if (open.length > 1) await prisma.alert.updateMany({ where: { id: { in: open.slice(1).map((a) => a.id) } }, data: { resolved: true } });
}

// Revisa os alertas abertos (ao abrir o dashboard ou a tela de alertas), sem criar alertas para unidades sem estoque
export async function syncOpenLowStockAlerts(unitIds?: string[]) {
  const open = await prisma.alert.findMany({
    where: { type: "LOW_STOCK", resolved: false, ...(unitIds ? { unitId: { in: unitIds } } : {}) },
    select: { unitId: true },
    distinct: ["unitId"],
  });
  await Promise.all(open.map((a) => syncLowStockAlert(a.unitId)));
}
