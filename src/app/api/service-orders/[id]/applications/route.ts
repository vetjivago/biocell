import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getAccessibleOrder, optDate, optText } from "@/lib/service-orders";

// Acrescenta a próxima aplicação (2ª, 3ª...) na mesma OS
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getAccessibleOrder(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  if (access.order.cancelled) return Response.json({ error: "OS cancelada" }, { status: 400 });

  const body = await request.json();
  const date = optDate(body.date);
  if (date === "invalid") return Response.json({ error: "Data inválida" }, { status: 400 });

  const last = await prisma.serviceOrderApplication.findFirst({ where: { serviceOrderId: id }, orderBy: { number: "desc" } });
  const number = (last?.number || 0) + 1;
  if (number > 6) return Response.json({ error: "Limite de 6 aplicações por OS" }, { status: 400 });

  const app = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceOrderApplication.create({
      data: {
        serviceOrderId: id,
        number,
        date,
        veterinarian: optText(body.veterinarian, 200),
        financial: optText(body.financial, 500),
        technicalNotes: optText(body.technicalNotes),
        applicationRoute: optText(body.applicationRoute, 200),
        cellQuantity: optText(body.cellQuantity, 100),
        preparation: optText(body.preparation),
      },
    });
    await tx.auditLog.create({
      data: { userId: session.id, action: "CREATE", entity: "ServiceOrderApplication", entityId: created.id, details: JSON.stringify({ serviceOrderId: id, number }) },
    });
    return created;
  });
  return Response.json(app, { status: 201 });
}
