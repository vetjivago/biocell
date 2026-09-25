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
  const { unitId, batchId, type, quantity, reason } = body;

  if (!unitId || !batchId || !type || !quantity) {
    return Response.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const existing = await prisma.inventoryTransaction.findMany({
    where: { unitId, batchId },
  });
  const currentBalance = existing.reduce((sum, t) => sum + t.quantity, 0);
  const newBalance = currentBalance + quantity;

  if (newBalance < 0) {
    return Response.json({ error: `Saldo insuficiente. Atual: ${currentBalance}` }, { status: 400 });
  }

  const transaction = await prisma.inventoryTransaction.create({
    data: { unitId, batchId, type, quantity, balance: newBalance, reason, performedBy: session.name },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id, action: type, entity: "InventoryTransaction",
      entityId: transaction.id, details: JSON.stringify({ unitId, batchId, quantity, newBalance }),
    },
  });

  return Response.json(transaction, { status: 201 });
}
