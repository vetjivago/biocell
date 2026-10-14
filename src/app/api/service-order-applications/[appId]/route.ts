import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getAccessibleOrder, optDate, optText } from "@/lib/service-orders";

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
    id: app.id, number: app.number, status: app.status, medicalRecordId: app.medicalRecordId,
    veterinarian: app.veterinarian, technicalNotes: app.technicalNotes,
    serviceOrder: app.serviceOrder,
  });
}

// Edita os dados da aplicação ou marca "em preparo". "Concluída" só via prontuário vinculado.
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
  if (body.status !== undefined) {
    if (app.status === "DONE") return Response.json({ error: "Aplicação já concluída (prontuário preenchido)" }, { status: 400 });
    if (body.status !== "OPEN" && body.status !== "IN_PREP") return Response.json({ error: "Status inválido" }, { status: 400 });
    data.status = body.status;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.serviceOrderApplication.update({ where: { id: appId }, data });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "UPDATE", entity: "ServiceOrderApplication", entityId: appId,
        details: JSON.stringify({ changed: Object.keys(data), before: { date: app.date, veterinarian: app.veterinarian, financial: app.financial, technicalNotes: app.technicalNotes, status: app.status } }),
      },
    });
    return u;
  });
  return Response.json(updated);
}
