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
    patientId: existingPatientId,
    patientName, patientSpecies, patientBreed, patientWeight,
    ownerName, veterinarian, clinic,
    unitId, pathology, cellQuantity, applicationRoute,
    donors, serumCollected, applications, thawings,
  } = body;

  if (!unitId || !pathology) {
    return Response.json({ error: "Campos obrigatórios faltando (unidade e patologia)" }, { status: 400 });
  }

  if (!existingPatientId && (!patientName || !patientSpecies || !ownerName)) {
    return Response.json({ error: "Campos obrigatórios faltando (nome, espécie e responsável)" }, { status: 400 });
  }

  if (session.role !== "ADMIN" && !session.unitIds.includes(unitId)) {
    return Response.json({ error: "Sem permissão para esta unidade" }, { status: 403 });
  }

  const validApps = (applications || []).filter(
    (a: { date?: string; cells?: string }) => a.date || a.cells
  );
  const validThawings = (thawings || []).filter(
    (t: { thawedStraws?: number | string; thawedMeio?: number | string; thawedSoro?: number | string; retrievalLocation?: string }) =>
      (t.thawedStraws && Number(t.thawedStraws) > 0) || (t.thawedMeio && Number(t.thawedMeio) > 0) || (t.thawedSoro && Number(t.thawedSoro) > 0) || t.retrievalLocation
  );

  try {
    const record = await prisma.$transaction(async (tx) => {
      let resolvedPatientId = existingPatientId;

      if (!resolvedPatientId) {
        const patient = await tx.patient.create({
          data: {
            name: patientName,
            species: patientSpecies,
            breed: patientBreed || null,
            weight: patientWeight || null,
            ownerName: ownerName || "",
            veterinarian: veterinarian || null,
            clinic: clinic || null,
            unitId,
          },
        });
        resolvedPatientId = patient.id;
      }

      const mr = await tx.medicalRecord.create({
        data: {
          patientId: resolvedPatientId,
          unitId,
          professionalId: session.id,
          pathology,
          cellQuantity: cellQuantity || null,
          applicationRoute: applicationRoute || null,
          donors: donors || null,
          serumCollected: serumCollected || false,
          ...(validApps.length > 0
            ? {
                applications: {
                  createMany: {
                    data: validApps.map((a: { number: number; date?: string; cells?: string; serum?: string; medium?: string }) => ({
                      number: a.number,
                      date: a.date ? new Date(a.date) : null,
                      cells: a.cells || null,
                      serum: a.serum || null,
                      medium: a.medium || null,
                    })),
                  },
                },
              }
            : {}),
          ...(validThawings.length > 0
            ? {
                thawings: {
                  createMany: {
                    data: validThawings.map((t: { number: number; thawedStraws?: number | string; thawedMeio?: number | string; thawedSoro?: number | string; retrievalLocation?: string }) => ({
                      number: t.number,
                      thawedStraws: t.thawedStraws ? Number(t.thawedStraws) : null,
                      thawedMeio: t.thawedMeio ? Number(t.thawedMeio) : null,
                      thawedSoro: t.thawedSoro ? Number(t.thawedSoro) : null,
                      retrievalLocation: t.retrievalLocation || null,
                    })),
                  },
                },
              }
            : {}),
        },
        include: { patient: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "CREATE",
          entity: "MedicalRecord",
          entityId: mr.id,
          details: JSON.stringify({ patientName: patientName || "paciente existente", pathology }),
        },
      });

      return mr;
    });

    return Response.json(record, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar prontuário:", err);
    return Response.json({ error: "Erro ao registrar prontuário" }, { status: 500 });
  }
}
