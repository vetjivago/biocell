import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { syncLowStockAlert } from "@/lib/stock-alerts";
import { hasRole } from "@/lib/roles";

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

  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(record.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Foto das palhetas é obrigatória (substitui as palhetas coladas no prontuário de papel)
  if ((await prisma.medicalRecordAttachment.count({ where: { medicalRecordId: id } })) === 0) {
    return Response.json({ error: "Anexe a foto das palhetas antes de concluir o atendimento" }, { status: 400 });
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
    const categoryLabel = item.category === "MEIO" ? "meio" : item.category === "SORO" ? "soro" : item.category === "MATERIAL" ? "material" : "células";

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

  // Recalcula o alerta de estoque baixo de células da unidade
  if (consumptionItems.some((i) => i.category === "CELULAS")) await syncLowStockAlert(record.unitId);

  return Response.json(updatedRecord);
}
