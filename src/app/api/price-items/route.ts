import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasRole } from "@/lib/roles";
import { nameTaken, parsePriceItem } from "@/lib/price-items";

// Tabela de preços dos orçamentos: só a matriz cadastra
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!hasRole(session.role, "ADMIN")) return Response.json({ error: "Sem permissão" }, { status: 403 });
  const items = await prisma.priceItem.findMany({ orderBy: { name: "asc" } });
  return Response.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!hasRole(session.role, "ADMIN")) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const parsed = parsePriceItem(await request.json());
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { name, price } = parsed.data as { name: string; price: number | null };
  if (await nameTaken(name)) return Response.json({ error: "Já existe um item com este nome" }, { status: 409 });

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.priceItem.create({ data: { name, price } });
    await tx.auditLog.create({ data: { userId: session.id, action: "CREATE", entity: "PriceItem", entityId: created.id, details: JSON.stringify({ name, price }) } });
    return created;
  });
  return Response.json(item, { status: 201 });
}
