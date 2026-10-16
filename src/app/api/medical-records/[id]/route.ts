import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      patient: true,
      unit: true,
      professional: true,
      applications: { orderBy: { number: "asc" } },
      thawings: { orderBy: { number: "asc" } },
    },
  });

  if (!record) return Response.json({ error: "Prontuário não encontrado" }, { status: 404 });

  if (session.role !== "ADMIN" && !session.unitIds.includes(record.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  return Response.json(record);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: { patient: true },
  });

  if (!record) return Response.json({ error: "Prontuário não encontrado" }, { status: 404 });

  if (session.role !== "ADMIN" && !session.unitIds.includes(record.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  if (record.status === "COMPLETED") {
    return Response.json({ error: "Prontuário já concluído não pode ser editado" }, { status: 400 });
  }

  const {
    patientName, patientSpecies, patientBreed, patientWeight,
    ownerName, ownerPhone, veterinarian, clinic,
    pathology, cellQuantity, applicationRoute, donors, serumCollected,
    applications, thawings,
  } = body;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: record.patientId },
      data: {
        name: patientName ?? record.patient.name,
        species: patientSpecies ?? record.patient.species,
        breed: patientBreed !== undefined ? patientBreed : record.patient.breed,
        weight: patientWeight !== undefined ? (patientWeight ? parseFloat(patientWeight) : null) : record.patient.weight,
        ownerName: ownerName !== undefined ? ownerName : record.patient.ownerName,
        ownerPhone: ownerPhone !== undefined ? ownerPhone : record.patient.ownerPhone,
        veterinarian: veterinarian !== undefined ? veterinarian : record.patient.veterinarian,
        clinic: clinic !== undefined ? clinic : record.patient.clinic,
      },
    });

    const updatedRecord = await tx.medicalRecord.update({
      where: { id },
      data: {
        pathology: pathology ?? record.pathology,
        cellQuantity: cellQuantity !== undefined ? cellQuantity : record.cellQuantity,
        applicationRoute: applicationRoute !== undefined ? applicationRoute : record.applicationRoute,
        donors: donors !== undefined ? donors : record.donors,
        serumCollected: serumCollected !== undefined ? serumCollected : record.serumCollected,
      },
      include: { patient: true },
    });

    if (applications) {
      await tx.application.deleteMany({ where: { medicalRecordId: id } });
      if (applications.length > 0) {
        await tx.application.createMany({
          data: applications.map((a: { number: number; date?: string; cells?: string; serum?: string; medium?: string }) => ({
            medicalRecordId: id,
            number: a.number,
            date: a.date ? new Date(a.date) : null,
            cells: a.cells || null,
            serum: a.serum || null,
            medium: a.medium || null,
          })),
        });
      }
    }

    if (thawings) {
      await tx.thawing.deleteMany({ where: { medicalRecordId: id } });
      if (thawings.length > 0) {
        await tx.thawing.createMany({
          data: thawings.map((t: { number: number; thawedStraws?: number; retrievalLocation?: string }) => ({
            medicalRecordId: id,
            number: t.number,
            thawedStraws: t.thawedStraws || null,
            retrievalLocation: t.retrievalLocation || null,
          })),
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: session.id,
        action: "UPDATE",
        entity: "MedicalRecord",
        entityId: id,
        details: JSON.stringify({ fields: Object.keys(body) }),
      },
    });

    return updatedRecord;
  });

  return Response.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: { inventoryTransactions: true },
  });

  if (!record) return Response.json({ error: "Prontuário não encontrado" }, { status: 404 });

  if (session.role !== "ADMIN" && !session.unitIds.includes(record.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  if (record.inventoryTransactions.length > 0) {
    return Response.json(
      { error: "Prontuário com movimentações de estoque não pode ser excluído" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.deleteMany({ where: { medicalRecordId: id } });
    await tx.thawing.deleteMany({ where: { medicalRecordId: id } });
    await tx.procedure.deleteMany({ where: { medicalRecordId: id } });
    await tx.medicalRecord.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: session.id,
        action: "DELETE",
        entity: "MedicalRecord",
        entityId: id,
        details: JSON.stringify({ pathology: record.pathology }),
      },
    });
  });

  return Response.json({ ok: true });
}
