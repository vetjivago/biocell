import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canAccessUnit } from "@/lib/patient-search";
import { parsePatientFields } from "@/lib/patient-fields";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, name: true } },
      medicalRecords: {
        orderBy: { createdAt: "asc" },
        include: {
          professional: { select: { name: true } },
          applications: { orderBy: { number: "asc" } },
          thawings: { orderBy: { number: "asc" } },
        },
      },
    },
  });

  if (!patient) return Response.json({ error: "Paciente não encontrado" }, { status: 404 });
  if (!canAccessUnit(session, patient.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  const lastRecord = patient.medicalRecords[patient.medicalRecords.length - 1];

  const previousApplications = patient.medicalRecords.flatMap((r) =>
    r.applications.map((a) => ({
      number: a.number,
      date: a.date?.toISOString().split("T")[0] || "",
      cells: a.cells || "",
      serum: a.serum || "",
      medium: a.medium || "",
    }))
  );

  const previousThawings = patient.medicalRecords.flatMap((r) =>
    r.thawings.map((t) => ({
      number: t.number,
      thawedStraws: t.thawedStraws?.toString() || "",
      thawedMeio: t.thawedMeio?.toString() || "",
      thawedSoro: t.thawedSoro?.toString() || "",
      retrievalLocation: t.retrievalLocation || "",
    }))
  );

  return Response.json({
    patient: {
      id: patient.id,
      name: patient.name,
      species: patient.species,
      breed: patient.breed,
      weight: patient.weight,
      ownerName: patient.ownerName,
      ownerPhone: patient.ownerPhone,
      veterinarian: patient.veterinarian,
      clinic: patient.clinic,
      unitId: patient.unitId,
      unitName: patient.unit.name,
    },
    lastRecord: lastRecord
      ? {
          pathology: lastRecord.pathology,
          cellQuantity: lastRecord.cellQuantity,
          applicationRoute: lastRecord.applicationRoute,
          donors: lastRecord.donors,
          serumCollected: lastRecord.serumCollected,
        }
      : null,
    previousApplications,
    previousThawings,
    records: [...patient.medicalRecords].reverse().map((r) => ({
      id: r.id,
      serialNumber: r.serialNumber,
      pathology: r.pathology,
      status: r.status,
      createdAt: r.createdAt,
      professionalName: r.professional.name,
    })),
  });
}

// Edita o cadastro do paciente (dados do animal e do tutor)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) return Response.json({ error: "Paciente não encontrado" }, { status: 404 });
  if (!canAccessUnit(session, patient.unitId)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const parsed = parsePatientFields(await request.json(), { partial: true });
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.patient.update({ where: { id }, data: parsed.data });
    const before = Object.fromEntries(Object.keys(parsed.data).map((k) => [k, (patient as Record<string, unknown>)[k]]));
    await tx.auditLog.create({
      data: { userId: session.id, action: "UPDATE", entity: "Patient", entityId: id, details: JSON.stringify({ before }) },
    });
    return u;
  });
  return Response.json(updated);
}
