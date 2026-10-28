import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { CHECKLIST_TERMS, canDeleteOrder, getAccessibleOrder, optText, parseChecklist, resolveOrderAlerts } from "@/lib/service-orders";
import { hasRole } from "@/lib/roles";

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
    if (!hasRole(session.role, "ADMIN", "UNIT_MANAGER")) {
      return Response.json({ error: "Só o gestor da unidade ou a matriz podem cancelar" }, { status: 403 });
    }
    data.cancelled = body.cancelled;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.serviceOrder.update({ where: { id }, data });
    // OS cancelada não espera mais o laboratório
    if (data.cancelled === true) await resolveOrderAlerts(tx, id);
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

// Apaga a OS aberta por engano: só enquanto nenhuma aplicação tem prontuário preenchido
// (depois disso ela faz parte do histórico clínico). Aplicações e anexos saem junto
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getAccessibleOrder(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { order } = access;
  if (!canDeleteOrder(session, order)) {
    return Response.json({ error: "Só quem abriu a OS, o gestor da unidade ou a matriz podem apagá-la" }, { status: 403 });
  }

  const apps = await prisma.serviceOrderApplication.findMany({
    where: { serviceOrderId: id },
    select: { number: true, status: true, medicalRecordId: true },
  });
  if (apps.some((a) => a.status === "DONE" || a.medicalRecordId)) {
    return Response.json({ error: "Esta OS já tem prontuário preenchido e não pode mais ser apagada" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.delete({ where: { id } });
    // O alerta "OS aberta" apontaria para uma OS que não existe mais
    await tx.alert.deleteMany({ where: { serviceOrderId: id } });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "DELETE", entity: "ServiceOrder", entityId: id,
        details: JSON.stringify({ serialNumber: order.serialNumber, patientId: order.patientId, unitId: order.unitId, createdById: order.createdById, applications: apps.length }),
      },
    });
  });
  return Response.json({ ok: true });
}
