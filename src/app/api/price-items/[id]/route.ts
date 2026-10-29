import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasRole } from "@/lib/roles";
import { nameTaken, parsePriceItem } from "@/lib/price-items";

// Altera nome, valor (vazio = preço livre) ou ativa/desativa um item da tabela de preços
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!hasRole(session.role, "ADMIN")) return Response.json({ error: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  const item = await prisma.priceItem.findUnique({ where: { id } });
  if (!item) return Response.json({ error: "Item não encontrado" }, { status: 404 });

  const parsed = parsePriceItem(await request.json(), { partial: true });
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (parsed.data.name && (await nameTaken(parsed.data.name, id))) {
    return Response.json({ error: "Já existe um item com este nome" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.priceItem.update({ where: { id }, data: parsed.data });
    await tx.auditLog.create({
      data: { userId: session.id, action: "UPDATE", entity: "PriceItem", entityId: id, details: JSON.stringify({ changed: parsed.data, before: { name: item.name, price: item.price, active: item.active } }) },
    });
    return u;
  });
  return Response.json(updated);
}

// Tira o item da tabela; orçamentos já feitos guardam a descrição e o valor e não mudam
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!hasRole(session.role, "ADMIN")) return Response.json({ error: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  const item = await prisma.priceItem.findUnique({ where: { id } });
  if (!item) return Response.json({ error: "Item não encontrado" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.priceItem.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: session.id, action: "DELETE", entity: "PriceItem", entityId: id, details: JSON.stringify({ name: item.name, price: item.price }) } });
  });
  return Response.json({ ok: true });
}
