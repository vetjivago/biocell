import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { MIN_STRAWS, RACKS, type Racks, brl, calculateOrder, canProcessPurchases, canRequestPurchases, strawsOf } from "@/lib/purchase-orders";
import { canSeeUnit, unitStockByProduct } from "@/lib/purchase-orders-server";
import { type CartLine, lineName, lineStock, parseCartLine, storeProduct } from "@/lib/store";
import { sendPurchaseOrderEmail } from "@/lib/mailer";
import { withAnyRole } from "@/lib/users";

// Fecha o carrinho da loja: raques viram células do pedido e o kit da OS (meios, soros e materiais)
// é calculado aqui pelo estoque da unidade; os demais itens do carrinho entram como "pedido extra"
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canRequestPurchases(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const body = await request.json();
  const unitId = typeof body.unitId === "string" ? body.unitId : "";
  if (!unitId || !canSeeUnit(session, unitId)) return Response.json({ error: "Escolha a unidade" }, { status: 400 });
  const unit = await prisma.unit.findFirst({ where: { id: unitId, active: true }, select: { id: true, name: true } });
  if (!unit) return Response.json({ error: "Unidade não encontrada" }, { status: 404 });

  // Junta linhas repetidas (mesmo produto e variação)
  const lines: CartLine[] = [];
  for (const raw of Array.isArray(body.lines) ? body.lines : []) {
    const l = parseCartLine(raw);
    if (!l) continue;
    const same = lines.find((x) => x.productId === l.productId && x.variant === l.variant);
    if (same) same.quantity += l.quantity;
    else lines.push(l);
  }
  if (!lines.length) return Response.json({ error: "O carrinho está vazio" }, { status: 400 });

  const racks = Object.fromEntries(RACKS.map((r) => [r.key, 0])) as Racks;
  for (const l of lines) {
    const rack = storeProduct(l.productId)?.rack;
    if (rack) racks[rack] = Math.min(100, racks[rack] + l.quantity);
  }
  const straws = strawsOf(racks);
  // Mínimo de 48 palhetas por pedido de células (a matriz pode lançar abaixo disso)
  if (straws > 0 && straws < MIN_STRAWS && !canProcessPurchases(session.role)) {
    return Response.json({ error: `Pedido de células: mínimo de ${MIN_STRAWS} palhetas (pode misturar espécies). No carrinho: ${straws}` }, { status: 400 });
  }

  const extras: Record<string, number> = {};
  for (const l of lines) for (const s of lineStock(l)) extras[s.productId] = (extras[s.productId] || 0) + s.qty;

  const { items } = calculateOrder(await unitStockByProduct(unitId), racks);
  const rows = items.map((i, position) => ({
    productId: i.productId, position, stockQty: i.stock, calculated: i.calculated,
    extra: extras[i.productId] || 0, quantity: i.calculated + (extras[i.productId] || 0),
  }));

  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null;
  const order = await prisma.purchaseOrder.create({
    data: {
      unitId, createdById: session.id, createdByName: session.name, ...racks, notes,
      items: { create: rows },
      lines: {
        create: lines.map((l, position) => {
          const p = storeProduct(l.productId)!;
          return { position, storeId: p.id, variant: l.variant, name: lineName(p, l.variant), quantity: l.quantity, unitPrice: p.price };
        }),
      },
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.id, action: "CREATE", entity: "PurchaseOrder", entityId: order.id, details: JSON.stringify({ number: order.number, unitId, racks, lines: lines.length }) },
  });

  // Aviso por e-mail para o administrativo e o comercial (no menu, todos veem o contador de pedidos aguardando)
  const recipients = await prisma.user.findMany({
    where: { organizationId: session.organizationId, active: true, deletedAt: null, email: { not: null }, OR: withAnyRole(["ADMINISTRATIVE", "COMMERCIAL"]) },
    select: { email: true },
  });
  await sendPurchaseOrderEmail(
    recipients.map((r) => r.email!).filter(Boolean),
    {
      number: order.number, unitName: unit.name, requester: session.name, straws, notes,
      lines: lines.map((l) => ({ name: lineName(storeProduct(l.productId)!, l.variant), quantity: l.quantity })),
      subtotal: brl(lines.reduce((s, l) => s + l.quantity * storeProduct(l.productId)!.price, 0)),
    },
    `${new URL(request.url).origin}/pedidos/${order.id}`,
  );
  return Response.json(order, { status: 201 });
}
