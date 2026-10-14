import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { CHECKLIST_TERMS, getAccessibleOrder, optText, parseChecklist } from "@/lib/service-orders";

// Edita dados gerais da OS, o checklist ("solicitado") ou cancela
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getAccessibleOrder(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { order } = access;

  const body = await request.json();
  const data: Record<string, unknown> = {};
  for (const [field, max] of [["clinic", 200], ["city", 200], ["disease", 300], ["diagnosisTime", 200]] as const) {
    if (body[field] !== undefined) data[field] = optText(body[field], max);
  }
  if (body.checklist && typeof body.checklist === "object") {
    const current = parseChecklist(order.checklist);
    for (const t of CHECKLIST_TERMS) {
      if (typeof body.checklist[t.key] === "boolean") current[t.key] = body.checklist[t.key];
    }
    data.checklist = JSON.stringify(current);
  }
  if (typeof body.cancelled === "boolean") {
    if (session.role !== "ADMIN" && session.role !== "UNIT_MANAGER") {
      return Response.json({ error: "Só o gestor da unidade ou a matriz podem cancelar" }, { status: 403 });
    }
    data.cancelled = body.cancelled;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.serviceOrder.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "UPDATE", entity: "ServiceOrder", entityId: id,
        details: JSON.stringify({ changed: Object.keys(data), before: { clinic: order.clinic, city: order.city, disease: order.disease, diagnosisTime: order.diagnosisTime, checklist: order.checklist, cancelled: order.cancelled } }),
      },
    });
    return u;
  });
  return Response.json(updated);
}
