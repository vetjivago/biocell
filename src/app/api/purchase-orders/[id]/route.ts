import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { NO_LOT, standardProduct } from "@/lib/products";
import { syncLowStockAlert } from "@/lib/stock-alerts";
import { PAYMENT_METHODS, SHIPPING_MODES, canProcessPurchases, needsLot, parseLots } from "@/lib/purchase-orders";
import { getAccessiblePurchaseOrder } from "@/lib/purchase-orders-server";

const int = (v: unknown, max = 99999) => Math.min(max, Math.max(0, Math.trunc(Number(v) || 0)));
const cents = (v: unknown) => Math.min(100_000_000, Math.max(0, Math.round(Number(v) || 0)));
const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);

// Ações: save (matriz ajusta quantidades, lotes, logística e financeiro), invoice, ship (entra no estoque
// da unidade), deliver (unidade ou matriz confirma a chegada) e cancel
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getAccessiblePurchaseOrder(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { order } = access;
  const body = await request.json();
  const action = String(body.action || "");
  const admin = canProcessPurchases(session.role);
  const isOwnUnit = session.unitIds.includes(order.unitId);
  const log = (details: object) => prisma.auditLog.create({
    data: { userId: session.id, action: `PURCHASE_${action.toUpperCase()}`, entity: "PurchaseOrder", entityId: order.id, details: JSON.stringify({ number: order.number, ...details }) },
  });

  if (action === "cancel") {
    // A unidade cancela enquanto aguarda; a matriz até o envio
    const allowed = admin ? ["WAITING", "INVOICED"].includes(order.status) : isOwnUnit && order.status === "WAITING";
    if (!allowed) return Response.json({ error: "Este pedido não pode mais ser cancelado" }, { status: 400 });
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await log({});
    return Response.json({ ok: true });
  }

  if (action === "deliver") {
    if (order.status !== "SHIPPED" || !(admin || isOwnUnit)) return Response.json({ error: "Só pedidos enviados podem ser marcados como entregues" }, { status: 400 });
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await log({});
    return Response.json({ ok: true });
  }

  if (!admin) return Response.json({ error: "Sem permissão" }, { status: 403 });
  if (!["WAITING", "INVOICED"].includes(order.status)) return Response.json({ error: "Pedido já enviado ou cancelado: não pode mais ser alterado" }, { status: 400 });

  // Ajustes da matriz (vêm junto em save, invoice e ship)
  if (body.items !== undefined || body.order !== undefined) {
    const items = Array.isArray(body.items) ? body.items : [];
    const o = body.order ?? {};
    await prisma.$transaction([
      ...order.items.flatMap((it) => {
        const input = items.find((x: { id?: unknown }) => x?.id === it.id);
        if (!input) return [];
        return prisma.purchaseOrderItem.update({
          where: { id: it.id },
          data: { quantity: int(input.quantity), lots: parseLots(input.lots) },
        });
      }),
      prisma.purchaseOrder.update({
        where: { id },
        data: {
          dryIce: !!o.dryIce,
          dryIceQty: int(o.dryIceQty, 999),
          shippingMode: SHIPPING_MODES.includes(o.shippingMode) ? o.shippingMode : null,
          carrier: text(o.carrier),
          freight: cents(o.freight),
          extraValue: cents(o.extraValue),
          discount: cents(o.discount),
          paymentMethod: PAYMENT_METHODS.includes(o.paymentMethod) ? o.paymentMethod : null,
          installments: text(o.installments, 40),
          adminNotes: text(o.adminNotes, 2000),
        },
      }),
    ]);
  }

  if (action === "save") {
    await log({});
    return Response.json({ ok: true });
  }

  if (action === "invoice") {
    if (order.status !== "WAITING") return Response.json({ error: "Pedido já faturado" }, { status: 400 });
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "INVOICED", invoicedAt: new Date() } });
    await log({});
    return Response.json({ ok: true });
  }

  if (action === "ship") {
    const items = await prisma.purchaseOrderItem.findMany({ where: { orderId: id }, orderBy: { position: "asc" } });
    // Lote obrigatório em células, meios e soros; a soma dos lotes tem de bater com a quantidade
    for (const it of items.filter((i) => i.quantity > 0)) {
      const name = standardProduct(it.productId)?.name ?? it.productId;
      const lots = parseLots(it.lots);
      if (!needsLot(it.productId)) continue;
      if (lots.some((l) => !l.batchNumber || l.quantity <= 0)) return Response.json({ error: `${name}: preencha lote e quantidade de cada linha` }, { status: 400 });
      const sum = lots.reduce((s, l) => s + l.quantity, 0);
      if (sum !== it.quantity) return Response.json({ error: `${name}: os lotes somam ${sum}, mas o envio é de ${it.quantity}` }, { status: 400 });
    }

    const reason = `Pedido de compra nº ${order.number}`;
    await prisma.$transaction(async (tx) => {
      for (const it of items.filter((i) => i.quantity > 0)) {
        const product = standardProduct(it.productId);
        if (!product) continue;
        await tx.cellProduct.upsert({
          where: { id: product.id },
          update: {},
          create: { id: product.id, name: product.name, code: product.code, category: product.category, species: product.species, description: product.presentation },
        });
        const lots = needsLot(it.productId) ? parseLots(it.lots) : [{ batchNumber: NO_LOT, quantity: it.quantity }];
        for (const lot of lots) {
          let batch = await tx.cellBatch.findFirst({ where: { batchNumber: lot.batchNumber, productId: product.id } });
          if (!batch) batch = await tx.cellBatch.create({ data: { batchNumber: lot.batchNumber, productId: product.id, totalStraws: 0 } });
          const prev = await tx.inventoryTransaction.aggregate({ where: { unitId: order.unitId, batchId: batch.id }, _sum: { quantity: true } });
          await tx.inventoryTransaction.create({
            data: {
              unitId: order.unitId, batchId: batch.id, type: "RECEIPT", quantity: lot.quantity,
              balance: (prev._sum.quantity || 0) + lot.quantity, reason, performedBy: session.name,
            },
          });
        }
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "SHIPPED", shippedAt: new Date(), shippedBy: session.name, ...(order.invoicedAt ? {} : { invoicedAt: new Date() }) },
      });
    }, { timeout: 30000 });
    await syncLowStockAlert(order.unitId);
    await log({ items: items.filter((i) => i.quantity > 0).length });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Ação inválida" }, { status: 400 });
}
