import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canSendToLab, getAccessibleOrder, optDate, optText, resolveOrderAlerts } from "@/lib/service-orders";

// Contexto da aplicação para o formulário de prontuário
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { appId } = await params;
  const app = await prisma.serviceOrderApplication.findUnique({
    where: { id: appId },
    include: { serviceOrder: { select: { id: true, serialNumber: true, patientId: true, disease: true, clinic: true, cancelled: true } } },
  });
  if (!app) return Response.json({ error: "Aplicação não encontrada" }, { status: 404 });
  const access = await getAccessibleOrder(session, app.serviceOrderId);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  return Response.json({
    id: app.id, number: app.number, status: app.status, medicalRecordId: app.medicalRecordId, date: app.date,
    veterinarian: app.veterinarian, technicalNotes: app.technicalNotes,
    applicationRoute: app.applicationRoute, cellQuantity: app.cellQuantity, preparation: app.preparation,
    serviceOrder: app.serviceOrder,
  });
}

// Edita os dados da aplicação, marca "em preparo" ou conclui a OS (avisa o laboratório).
// "Concluída" só via prontuário vinculado.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { appId } = await params;

  const app = await prisma.serviceOrderApplication.findUnique({ where: { id: appId } });
  if (!app) return Response.json({ error: "Aplicação não encontrada" }, { status: 404 });
  const access = await getAccessibleOrder(session, app.serviceOrderId);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.date !== undefined) {
    const d = optDate(body.date);
    if (d === "invalid") return Response.json({ error: "Data inválida" }, { status: 400 });
    data.date = d;
  }
  if (body.veterinarian !== undefined) data.veterinarian = optText(body.veterinarian, 200);
  if (body.financial !== undefined) data.financial = optText(body.financial, 500);
  if (body.technicalNotes !== undefined) data.technicalNotes = optText(body.technicalNotes);
  if (body.applicationRoute !== undefined) data.applicationRoute = optText(body.applicationRoute, 200);
  if (body.cellQuantity !== undefined) data.cellQuantity = optText(body.cellQuantity, 100);
  if (body.preparation !== undefined) data.preparation = optText(body.preparation);
  if (body.status !== undefined) {
    if (app.status === "DONE") return Response.json({ error: "Aplicação já concluída (prontuário preenchido)" }, { status: 400 });
    if (body.status !== "OPEN" && body.status !== "IN_PREP") return Response.json({ error: "Status inválido" }, { status: 400 });
    data.status = body.status;
  }

  // Concluir OS: o veterinário terminou o pedido e o laboratório recebe o alerta "OS aberta"
  const sendToLab = body.sendToLab === true;
  if (sendToLab) {
    if (!canSendToLab(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });
    if (access.order.cancelled) return Response.json({ error: "OS cancelada" }, { status: 400 });
    if (app.status !== "OPEN") return Response.json({ error: "O laboratório já está com esta aplicação" }, { status: 400 });
    if (app.sentToLabAt) return Response.json({ error: "Esta OS já foi concluída e enviada ao laboratório" }, { status: 400 });
    data.sentToLabAt = new Date();
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.serviceOrderApplication.update({ where: { id: appId }, data });
    if (sendToLab) {
      const order = await tx.serviceOrder.findUniqueOrThrow({
        where: { id: app.serviceOrderId },
        select: { serialNumber: true, unitId: true, patient: { select: { name: true, species: true } } },
      });
      await tx.alert.create({
        data: {
          unitId: order.unitId, type: "SERVICE_ORDER", serviceOrderId: app.serviceOrderId,
          message: `OS ${order.serialNumber} aberta: ${app.number}ª aplicação de ${order.patient.name} (${order.patient.species}), enviada por ${session.name}. Aguardando preparo.`,
        },
      });
    }
    if (data.status === "IN_PREP") await resolveOrderAlerts(tx, app.serviceOrderId);
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "UPDATE", entity: "ServiceOrderApplication", entityId: appId,
        details: JSON.stringify({ changed: Object.keys(data), before: { date: app.date, veterinarian: app.veterinarian, financial: app.financial, technicalNotes: app.technicalNotes, applicationRoute: app.applicationRoute, cellQuantity: app.cellQuantity, preparation: app.preparation, status: app.status } }),
      },
    });
    return u;
  });
  return Response.json(updated);
}
