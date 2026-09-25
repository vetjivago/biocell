import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const unitId = searchParams.get("unitId");

  const isAdmin = session.role === "ADMIN";
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
    patientId, unitId, pathology, cellQuantity, applicationRoute,
    donors, serumCollected, applications, thawings,
  } = body;

  if (!patientId || !unitId || !pathology) {
    return Response.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  if (session.role !== "ADMIN" && !session.unitIds.includes(unitId)) {
    return Response.json({ error: "Sem permissão para esta unidade" }, { status: 403 });
  }

  const record = await prisma.medicalRecord.create({
    data: {
      patientId,
      unitId,
      professionalId: session.id,
      pathology,
      cellQuantity,
      applicationRoute,
      donors,
      serumCollected: serumCollected || false,
      applications: applications?.length ? {
        createMany: {
          data: applications.map((a: { number: number; date?: string; cells?: string; serum?: string; medium?: string }) => ({
            number: a.number,
            date: a.date ? new Date(a.date) : null,
            cells: a.cells,
            serum: a.serum,
            medium: a.medium,
          })),
        },
      } : undefined,
      thawings: thawings?.length ? {
        createMany: {
          data: thawings.map((t: { number: number; thawedStraws?: number; retrievalLocation?: string }) => ({
            number: t.number,
            thawedStraws: t.thawedStraws,
            retrievalLocation: t.retrievalLocation,
          })),
        },
      } : undefined,
    },
    include: { patient: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id, action: "CREATE", entity: "MedicalRecord",
      entityId: record.id, details: JSON.stringify({ patientName: record.patient.name, pathology }),
    },
  });

  return Response.json(record, { status: 201 });
}
