import { prisma } from "@/lib/prisma";
import { canSupplyStock, seesAllUnits } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import { syncLowStockAlert } from "@/lib/stock-alerts";
import { NextRequest } from "next/server";

// Estorna um recebimento lançado por engano (ex.: duplicado sem lote): não apaga o registro,
// lança um ajuste de saída com a mesma quantidade e guarda o vínculo na auditoria
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canSupplyStock(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });
  const { id } = await params;

  const original = await prisma.inventoryTransaction.findUnique({ where: { id } });
  if (!original) return Response.json({ error: "Lançamento não encontrado" }, { status: 404 });
  if (!seesAllUnits(session.role) && !session.unitIds.includes(original.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (original.type !== "RECEIPT" || original.quantity <= 0) {
    return Response.json({ error: "Só é possível estornar recebimentos" }, { status: 400 });
  }

  const already = await prisma.auditLog.findFirst({ where: { action: "REVERSAL", entity: "InventoryTransaction", entityId: id } });
  if (already) return Response.json({ error: "Este lançamento já foi estornado" }, { status: 400 });

  const current = await prisma.inventoryTransaction.aggregate({
    where: { unitId: original.unitId, batchId: original.batchId },
    _sum: { quantity: true },
  });
  const currentBalance = current._sum.quantity || 0;
  if (currentBalance < original.quantity) {
    return Response.json({ error: `Saldo insuficiente para estornar: o lote tem ${currentBalance} e o lançamento foi de ${original.quantity}. Parte já foi usada.` }, { status: 400 });
  }

  const reversal = await prisma.inventoryTransaction.create({
    data: {
      unitId: original.unitId,
      batchId: original.batchId,
      type: "ADJUSTMENT",
      quantity: -original.quantity,
      balance: currentBalance - original.quantity,
      reason: `Estorno de lançamento (${new Date(original.createdAt).toLocaleDateString("pt-BR")})`,
      performedBy: session.name,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: "REVERSAL",
      entity: "InventoryTransaction",
      entityId: id,
      details: JSON.stringify({ reversalId: reversal.id, unitId: original.unitId, batchId: original.batchId, quantity: original.quantity }),
    },
  });

  await syncLowStockAlert(original.unitId);

  return Response.json(reversal, { status: 201 });
}
