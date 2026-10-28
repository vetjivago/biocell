import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { nextSerial, optDate, optText } from "@/lib/service-orders";
import { hasRole } from "@/lib/roles";

// Sugestão do próximo nº de série
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const last = await prisma.serviceOrder.findMany({ select: { serialNumber: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return Response.json({ nextSerial: nextSerial(last.map((o) => o.serialNumber)) });
}

// Abre a OS com a 1ª aplicação
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const serialNumber = optText(body.serialNumber, 30);
  if (!body.patientId || !serialNumber) {
    return Response.json({ error: "Paciente e nº de série são obrigatórios" }, { status: 400 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: body.patientId },
    include: { unit: { select: { serviceOrderEnabled: true } } },
  });
  if (!patient) return Response.json({ error: "Paciente não encontrado" }, { status: 404 });
  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(patient.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (!patient.unit.serviceOrderEnabled) {
    return Response.json({ error: "Ordem de serviço não habilitada para esta unidade" }, { status: 403 });
  }
  if (await prisma.serviceOrder.findUnique({ where: { serialNumber } })) {
    return Response.json({ error: `O nº de série ${serialNumber} já está em uso` }, { status: 409 });
  }

  const app = body.application || {};
  const date = optDate(app.date);
  if (date === "invalid") return Response.json({ error: "Data da aplicação inválida" }, { status: 400 });

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceOrder.create({
      data: {
        serialNumber,
        patientId: patient.id,
        unitId: patient.unitId,
        createdById: session.id,
        clinic: optText(body.clinic, 200),
        city: optText(body.city, 200),
        disease: optText(body.disease, 300),
        diagnosisTime: optText(body.diagnosisTime, 200),
        applications: {
          create: {
            number: 1,
            date,
            veterinarian: optText(app.veterinarian, 200),
            financial: optText(app.financial, 500),
            technicalNotes: optText(app.technicalNotes),
            applicationRoute: optText(app.applicationRoute, 200),
            cellQuantity: optText(app.cellQuantity, 100),
            preparation: optText(app.preparation),
          },
        },
      },
    });
    await tx.auditLog.create({
      data: { userId: session.id, action: "CREATE", entity: "ServiceOrder", entityId: created.id, details: JSON.stringify({ serialNumber, patientId: patient.id }) },
    });
    return created;
  });

  return Response.json(order, { status: 201 });
}
