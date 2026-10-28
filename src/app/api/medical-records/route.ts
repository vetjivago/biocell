import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { checkApplications, parseApplications, parseThawings, summarize, validateLots } from "@/lib/record-applications";
import { nextRecordSerial } from "@/lib/record-serial";
import { Prisma } from "@prisma/client";
import { hasRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const unitId = searchParams.get("unitId");

  const isAdmin = hasRole(session.role, "ADMIN");
  if (unitId && !isAdmin && !session.unitIds.includes(unitId)) return Response.json([], { status: 403 });
  const where = {
    ...(isAdmin ? {} : { unitId: { in: session.unitIds } }),
    ...(status ? { status } : {}),
    ...(unitId ? { unitId } : {}),
  };

  const records = await prisma.medicalRecord.findMany({
    where,
    include: {
      patient: true,
      unit: { select: { name: true } },
      professional: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(records);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const {
    patientId: existingPatientId,
    pathology, cellQuantity, applicationRoute,
    donors, serumCollected, applications, thawings,
    serviceOrderApplicationId,
  } = body;

  if (!existingPatientId) {
    return Response.json({ error: "Selecione um paciente. Novos prontuários são abertos pela aba Pacientes." }, { status: 400 });
  }

  if (!pathology) {
    return Response.json({ error: "Campos obrigatórios faltando (patologia)" }, { status: 400 });
  }

  const existingPatient = await prisma.patient.findUnique({ where: { id: existingPatientId }, select: { unitId: true, name: true } });
  if (!existingPatient) {
    return Response.json({ error: "Paciente não encontrado" }, { status: 404 });
  }
  const unitId = existingPatient.unitId;

  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(unitId)) {
    return Response.json({ error: "Sem permissão para esta unidade" }, { status: 403 });
  }

  // Prontuário preenchido a partir de uma aplicação da Ordem de Serviço
  let serviceOrderApp: { id: string } | null = null;
  if (serviceOrderApplicationId) {
    const soa = await prisma.serviceOrderApplication.findUnique({
      where: { id: String(serviceOrderApplicationId) },
      include: { serviceOrder: { select: { patientId: true, cancelled: true } } },
    });
    if (!soa || soa.serviceOrder.patientId !== existingPatientId) {
      return Response.json({ error: "Ordem de serviço não corresponde a este paciente" }, { status: 400 });
    }
    if (soa.serviceOrder.cancelled) return Response.json({ error: "Ordem de serviço cancelada" }, { status: 400 });
    if (soa.medicalRecordId) return Response.json({ error: "Esta aplicação da OS já tem prontuário preenchido" }, { status: 409 });
    serviceOrderApp = { id: soa.id };
  }

  const validApps = parseApplications(applications);
  const appError = checkApplications(validApps);
  if (appError) return Response.json({ error: appError }, { status: 400 });
  const lots = await validateLots(validApps, unitId);
  if ("error" in lots) return Response.json({ error: lots.error }, { status: 400 });
  const { batchInfo } = lots;
  const validThawings = parseThawings(thawings);

  // Dois prontuários salvos ao mesmo tempo podem disputar o mesmo número: tenta de novo
  for (let attempt = 0; ; attempt++) {
    try {
      const record = await prisma.$transaction(async (tx) => {
        const mr = await tx.medicalRecord.create({
          data: {
            serialNumber: await nextRecordSerial(tx),
            patientId: existingPatientId,
            unitId,
            professionalId: session.id,
            pathology,
            cellQuantity: cellQuantity || null,
            applicationRoute: applicationRoute || null,
            donors: donors || null,
            serumCollected: serumCollected || false,
            ...(validThawings.length > 0 ? { thawings: { createMany: { data: validThawings } } } : {}),
          },
          include: { patient: true },
        });

        for (const a of validApps) {
          await tx.application.create({
            data: {
              medicalRecordId: mr.id,
              number: a.number,
              date: a.date ? new Date(a.date) : null,
              preparedBy: a.preparedBy,
              cells: summarize(a.items, "CELULAS", batchInfo, a.cells),
              serum: summarize(a.items, "SORO", batchInfo, a.serum),
              medium: summarize(a.items, "MEIO", batchInfo, a.medium),
              ...(a.items.length > 0 ? { items: { createMany: { data: a.items } } } : {}),
            },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: session.id,
            action: "CREATE",
            entity: "MedicalRecord",
            entityId: mr.id,
            details: JSON.stringify({ patientName: existingPatient.name, pathology, serviceOrderApplicationId: serviceOrderApp?.id }),
          },
        });

        if (serviceOrderApp) {
          // updateMany com medicalRecordId nulo evita vincular duas vezes em requisições simultâneas
          const linked = await tx.serviceOrderApplication.updateMany({
            where: { id: serviceOrderApp.id, medicalRecordId: null },
            data: { medicalRecordId: mr.id, status: "DONE" },
          });
          if (linked.count === 0) throw new Error("OS_ALREADY_LINKED");
        }

        return mr;
      });

      return Response.json(record, { status: 201 });
    } catch (err) {
      const serialTaken = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
        && String(err.meta?.target ?? "").includes("serialNumber");
      if (serialTaken && attempt < 4) continue;
      if (err instanceof Error && err.message === "OS_ALREADY_LINKED") {
        return Response.json({ error: "Esta aplicação da OS já tem prontuário preenchido" }, { status: 409 });
      }
      console.error("Erro ao criar prontuário:", err);
      return Response.json({ error: "Erro ao registrar prontuário" }, { status: 500 });
    }
  }
}
