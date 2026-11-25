import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { MIN_STRAWS, ORDER_ITEMS, RACKS, type Racks, calculateOrder, canProcessPurchases, canRequestPurchases, strawsOf } from "@/lib/purchase-orders";
import { canSeeUnit, unitStockByProduct } from "@/lib/purchase-orders-server";

const int = (v: unknown, max = 9999) => Math.min(max, Math.max(0, Math.trunc(Number(v) || 0)));

// A unidade (ou a matriz por ela) faz o pedido: raques + extras; o restante é calculado aqui pela regra da OS
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canRequestPurchases(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const body = await request.json();
  const unitId = typeof body.unitId === "string" ? body.unitId : "";
  if (!unitId || !canSeeUnit(session, unitId)) return Response.json({ error: "Escolha a unidade" }, { status: 400 });
  const unit = await prisma.unit.findFirst({ where: { id: unitId, active: true }, select: { id: true } });
  if (!unit) return Response.json({ error: "Unidade não encontrada" }, { status: 404 });

  const racks = Object.fromEntries(RACKS.map((r) => [r.key, int(body.racks?.[r.key], 100)])) as Racks;
  const straws = strawsOf(racks);
  // Mínimo de 48 palhetas por pedido de células (a matriz pode lançar abaixo disso)
  if (straws > 0 && straws < MIN_STRAWS && !canProcessPurchases(session.role)) {
    return Response.json({ error: `Pedido de células: mínimo de ${MIN_STRAWS} palhetas (pode misturar espécies). Agora: ${straws}` }, { status: 400 });
  }

  const extras: Record<string, number> = {};
  for (const { productId } of ORDER_ITEMS) extras[productId] = int(body.extras?.[productId]);
  for (const r of RACKS) extras[r.productId] = 0; // células só por raque

  const { items } = calculateOrder(await unitStockByProduct(unitId), racks);
  const rows = items.map((i, position) => ({
    productId: i.productId, position, stockQty: i.stock, calculated: i.calculated,
    extra: extras[i.productId] || 0, quantity: i.calculated + (extras[i.productId] || 0),
  }));
  if (!rows.some((r) => r.quantity > 0)) return Response.json({ error: "O pedido está vazio: informe as raques ou algum item extra" }, { status: 400 });

  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null;
  const order = await prisma.purchaseOrder.create({
    data: { unitId, createdById: session.id, createdByName: session.name, ...racks, notes, items: { create: rows } },
  });
  await prisma.auditLog.create({
    data: { userId: session.id, action: "CREATE", entity: "PurchaseOrder", entityId: order.id, details: JSON.stringify({ number: order.number, unitId, racks }) },
  });
  return Response.json(order, { status: 201 });
}
