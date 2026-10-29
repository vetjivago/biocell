import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageSale, getAccessibleSale, parsePayment, parseQuoteFields } from "@/lib/sales";
import { applyFixedPrices } from "@/lib/price-items";
import { NextRequest } from "next/server";

// action:
//  "update"  – itens, validade, observações e desconto (itens só enquanto for orçamento);
//              numa venda também corrige a forma de pagamento
//  "convert" – converte o orçamento em venda com a forma de pagamento
//  "revert"  – desfaz a venda (volta a ser orçamento)
//  "cancel" / "reopen"
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getAccessibleSale(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { sale } = access;

  const body = await request.json();
  const action = String(body.action || "update");
  const before = {
    status: sale.status, discount: sale.discount, notes: sale.notes, validUntil: sale.validUntil,
    paymentMethod: sale.paymentMethod, installments: sale.installments, paymentNotes: sale.paymentNotes, soldAt: sale.soldAt,
    items: sale.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
  };
  const fail = (error: string, status = 400) => Response.json({ error }, { status });
  const manager = canManageSale(session, sale);

  let data: Record<string, unknown> = {};
  let items: { description: string; quantity: number; unitPrice: number }[] | undefined;

  if (action === "update") {
    if (sale.status === "CANCELLED") return fail("Orçamento cancelado: reabra para editar", 409);
    const parsed = parseQuoteFields(body, { partial: true });
    if ("error" in parsed) return fail(parsed.error);
    ({ items, ...data } = parsed.data);
    // Itens da tabela de preços com valor fixo: vale o valor da tabela
    if (items) items = await applyFixedPrices(items);
    if (sale.status === "SALE" && items) return fail("Os itens de uma venda não podem ser alterados. Desfaça a venda para editar", 409);
    const subtotal = (items ?? sale.items).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (((data.discount as number | undefined) ?? sale.discount) > subtotal) return fail("O desconto não pode ser maior que o subtotal");
    if (sale.status === "SALE" && body.paymentMethod !== undefined) {
      const pay = parsePayment(body);
      if ("error" in pay) return fail(pay.error);
      data = { ...data, ...pay.data };
    }
  } else if (action === "convert") {
    if (sale.status !== "QUOTE") return fail("Só um orçamento em aberto pode ser convertido em venda", 409);
    if (sale.items.length === 0) return fail("Adicione itens antes de converter em venda");
    const pay = parsePayment(body);
    if ("error" in pay) return fail(pay.error);
    data = { ...pay.data, status: "SALE", soldById: session.id };
  } else if (action === "revert") {
    if (sale.status !== "SALE") return fail("Este registro não é uma venda", 409);
    if (!manager) return fail("Só quem criou, o gestor da unidade ou a matriz podem desfazer a venda", 403);
    data = { status: "QUOTE", soldAt: null, soldById: null, paymentMethod: null, installments: null, paymentNotes: null };
  } else if (action === "cancel") {
    if (sale.status === "CANCELLED") return fail("Já está cancelado", 409);
    if (!manager) return fail("Só quem criou, o gestor da unidade ou a matriz podem cancelar", 403);
    data = { status: "CANCELLED", cancelledAt: new Date() };
  } else if (action === "reopen") {
    if (sale.status !== "CANCELLED") return fail("Não está cancelado", 409);
    if (!manager) return fail("Só quem criou, o gestor da unidade ou a matriz podem reabrir", 403);
    // Volta ao que era antes de cancelar (venda continua venda)
    data = { status: sale.soldAt ? "SALE" : "QUOTE", cancelledAt: null };
  } else {
    return fail("Ação inválida");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (items) {
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.saleItem.createMany({ data: items.map((i, position) => ({ ...i, position, saleId: id })) });
    }
    const u = await tx.sale.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: action === "update" ? "UPDATE" : action.toUpperCase(), entity: "Sale", entityId: id,
        details: JSON.stringify({ changed: [...Object.keys(data), ...(items ? ["items"] : [])], before }),
      },
    });
    return u;
  });
  return Response.json(updated);
}

// Apaga orçamento criado por engano (vendas precisam ser desfeitas ou canceladas antes)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getAccessibleSale(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { sale } = access;
  if (!canManageSale(session, sale)) {
    return Response.json({ error: "Só quem criou, o gestor da unidade ou a matriz podem apagar" }, { status: 403 });
  }
  if (sale.status === "SALE") {
    return Response.json({ error: "Uma venda não pode ser apagada. Cancele ou desfaça a venda antes" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.sale.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "DELETE", entity: "Sale", entityId: id,
        details: JSON.stringify({
          number: sale.number, patientId: sale.patientId, unitId: sale.unitId, status: sale.status, discount: sale.discount,
          items: sale.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
        }),
      },
    });
  });
  return Response.json({ ok: true });
}
