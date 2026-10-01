import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { batchId, strawsUsed } = body;

  if (!batchId || !strawsUsed || strawsUsed <= 0) {
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

  // Calculate current balance for this batch at this unit
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { unitId: record.unitId, batchId },
  });
  const currentBalance = transactions.reduce((sum, t) => sum + t.quantity, 0);

  if (currentBalance < strawsUsed) {
    return Response.json({
      error: `Estoque insuficiente. Disponível: ${currentBalance} palhetas`,
    }, { status: 400 });
  }

  // Transaction: update record + create inventory movement
  const [updatedRecord] = await prisma.$transaction([
    prisma.medicalRecord.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.inventoryTransaction.create({
      data: {
        unitId: record.unitId,
        batchId,
        type: "CONSUMPTION",
        quantity: -strawsUsed,
        balance: currentBalance - strawsUsed,
        medicalRecordId: id,
        reason: `Consumo atendimento – ${record.patient.name} – ${record.pathology}`,
        performedBy: session.name,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "CONSUMPTION",
        entity: "MedicalRecord",
        entityId: id,
        details: JSON.stringify({ batchId, strawsUsed, newBalance: currentBalance - strawsUsed }),
      },
    }),
  ]);

  // Check stock threshold based on total unit balance (default: 15)
  const allUnitTransactions = await prisma.inventoryTransaction.aggregate({
    where: { unitId: record.unitId },
    _sum: { quantity: true },
  });
  const totalUnitBalance = allUnitTransactions._sum.quantity || 0;

  const threshold = await prisma.stockThreshold.findFirst({
    where: { unitId: record.unitId },
  });
  const minStraws = threshold?.minimumStraws ?? 15;

  if (totalUnitBalance <= minStraws) {
    const existingAlert = await prisma.alert.findFirst({
      where: { unitId: record.unitId, type: "LOW_STOCK", resolved: false },
    });
    if (!existingAlert) {
      await prisma.alert.create({
        data: {
          unitId: record.unitId,
          type: "LOW_STOCK",
          message: `Estoque baixo: ${totalUnitBalance} palhetas restantes (mínimo: ${minStraws})`,
        },
      });
    }
  }

  return Response.json(updatedRecord);
}
