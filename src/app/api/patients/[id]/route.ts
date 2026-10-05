import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

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
          applications: { orderBy: { number: "asc" } },
          thawings: { orderBy: { number: "asc" } },
        },
      },
    },
  });

  if (!patient) return Response.json({ error: "Paciente não encontrado" }, { status: 404 });

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
  });
}
