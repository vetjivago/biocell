import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  const isAdmin = session.role === "ADMIN";
  const unitFilter = unitId
    ? { unitId }
    : isAdmin ? {} : { unitId: { in: session.unitIds } };

  const transactions = await prisma.inventoryTransaction.findMany({
    where: unitFilter,
    include: {
      batch: { include: { product: { select: { name: true, code: true } } } },
      unit: { select: { name: true } },
      medicalRecord: { select: { id: true, patient: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return Response.json(transactions);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  if (session.role !== "ADMIN" && session.role !== "STOCK") {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const { unitId, batchId, batchNumber, productName, type, quantity, reason } = body;

  if (!unitId || !type || !quantity) {
    return Response.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  let resolvedBatchId = batchId;

  if (!resolvedBatchId && batchNumber && productName) {
    let product = await prisma.cellProduct.findFirst({
      where: { name: { equals: productName, mode: "insensitive" } },
    });
    if (!product) {
      product = await prisma.cellProduct.create({
        data: { name: productName },
      });
    }

    let batch = await prisma.cellBatch.findFirst({
      where: { batchNumber, productId: product.id },
    });
    if (!batch) {
      batch = await prisma.cellBatch.create({
        data: {
          batchNumber,
          productId: product.id,
          totalStraws: 0,
        },
      });
    }

    resolvedBatchId = batch.id;
  }

  if (!resolvedBatchId) {
    return Response.json({ error: "Informe o lote e produto" }, { status: 400 });
  }

  const existing = await prisma.inventoryTransaction.findMany({
    where: { unitId, batchId: resolvedBatchId },
  });
  const currentBalance = existing.reduce((sum, t) => sum + t.quantity, 0);
  const newBalance = currentBalance + quantity;

  if (newBalance < 0) {
    return Response.json({ error: `Saldo insuficiente. Atual: ${currentBalance}` }, { status: 400 });
  }

  const transaction = await prisma.inventoryTransaction.create({
    data: {
      unitId,
      batchId: resolvedBatchId,
      type,
      quantity,
      balance: newBalance,
      reason,
      performedBy: session.name,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: type,
      entity: "InventoryTransaction",
      entityId: transaction.id,
      details: JSON.stringify({ unitId, batchId: resolvedBatchId, quantity, newBalance }),
    },
  });

  // Auto-resolve LOW_STOCK alerts if total unit balance is above threshold (default: 15)
  if (type === "SUPPLY" || type === "TRANSFER_IN") {
    const totalUnit = await prisma.inventoryTransaction.aggregate({
      where: { unitId },
      _sum: { quantity: true },
    });
    const totalBalance = totalUnit._sum.quantity || 0;
    const threshold = await prisma.stockThreshold.findFirst({ where: { unitId } });
    const minStraws = threshold?.minimumStraws ?? 15;

    if (totalBalance > minStraws) {
      await prisma.alert.updateMany({
        where: { unitId, type: "LOW_STOCK", resolved: false },
        data: { resolved: true },
      });
    }
  }

  return Response.json(transaction, { status: 201 });
}
