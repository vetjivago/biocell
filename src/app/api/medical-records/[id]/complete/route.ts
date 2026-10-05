import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

interface ConsumptionItem {
  batchId: string;
  quantity: number;
  category: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Support both old format (batchId+strawsUsed) and new format (items array)
  let consumptionItems: ConsumptionItem[];
  if (body.items) {
    consumptionItems = body.items;
  } else if (body.batchId && body.strawsUsed) {
    consumptionItems = [{ batchId: body.batchId, quantity: body.strawsUsed, category: "CELULAS" }];
  } else {
    return Response.json({ error: "Dados de consumo obrigatórios" }, { status: 400 });
  }

  if (consumptionItems.length === 0 || consumptionItems.some((i) => !i.batchId || !i.quantity || i.quantity <= 0)) {
    return Response.json({ error: "Lote e quantidade são obrigatórios" }, { status: 400 });
  }

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: { patient: true },
  });

  if (!record) return Response.json({ error: "Prontuário não encontrado" }, { status: 404 });

  if (session.role !== "ADMIN" && !session.unitIds.includes(record.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Validate balances for all items
  for (const item of consumptionItems) {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { unitId: record.unitId, batchId: item.batchId },
    });
    const balance = transactions.reduce((sum, t) => sum + t.quantity, 0);
    if (balance < item.quantity) {
      const batch = await prisma.cellBatch.findUnique({
        where: { id: item.batchId },
        include: { product: { select: { name: true } } },
      });
      return Response.json({
        error: `Estoque insuficiente de ${batch?.product.name || "produto"}. Disponível: ${balance}`,
      }, { status: 400 });
    }
  }

  // Prepare balance details for audit
  const balanceDetails: { batchId: string; quantity: number; newBalance: number; category: string }[] = [];
  const inventoryOps: { batchId: string; quantity: number; newBalance: number; categoryLabel: string }[] = [];

  for (const item of consumptionItems) {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { unitId: record.unitId, batchId: item.batchId },
    });
    const currentBalance = transactions.reduce((sum, t) => sum + t.quantity, 0);
    const newBalance = currentBalance - item.quantity;
    const categoryLabel = item.category === "MEIO" ? "meio" : item.category === "SORO" ? "soro" : "células";

    inventoryOps.push({ batchId: item.batchId, quantity: item.quantity, newBalance, categoryLabel });
    balanceDetails.push({ batchId: item.batchId, quantity: item.quantity, newBalance, category: item.category });
  }

  const updatedRecord = await prisma.$transaction(async (tx) => {
    const updated = await tx.medicalRecord.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    for (const op of inventoryOps) {
      await tx.inventoryTransaction.create({
        data: {
          unitId: record.unitId,
          batchId: op.batchId,
          type: "CONSUMPTION",
          quantity: -op.quantity,
          balance: op.newBalance,
          medicalRecordId: id,
          reason: `Consumo ${op.categoryLabel} – ${record.patient.name} – ${record.pathology}`,
          performedBy: session.name,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: session.id,
        action: "CONSUMPTION",
        entity: "MedicalRecord",
        entityId: id,
        details: JSON.stringify(balanceDetails),
      },
    });

    return updated;
  });

  // Check stock threshold for cells only (default: 15)
  const cellBatchIds = consumptionItems.filter((i) => i.category === "CELULAS").map((i) => i.batchId);
  if (cellBatchIds.length > 0) {
    const allCellTransactions = await prisma.inventoryTransaction.aggregate({
      where: {
        unitId: record.unitId,
        batch: { product: { category: "CELULAS" } },
      },
      _sum: { quantity: true },
    });
    const totalCellBalance = allCellTransactions._sum.quantity || 0;

    const threshold = await prisma.stockThreshold.findFirst({
      where: { unitId: record.unitId },
    });
    const minStraws = threshold?.minimumStraws ?? 15;

    if (totalCellBalance <= minStraws) {
      const existingAlert = await prisma.alert.findFirst({
        where: { unitId: record.unitId, type: "LOW_STOCK", resolved: false },
      });
      if (!existingAlert) {
        await prisma.alert.create({
          data: {
            unitId: record.unitId,
            type: "LOW_STOCK",
            message: `Estoque baixo de células: ${totalCellBalance} palhetas restantes (mínimo: ${minStraws})`,
          },
        });
      }
    }
  }

  return Response.json(updatedRecord);
}
