import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { parseSearchField, patientSearchWhere } from "@/lib/patient-search";
import { parsePatientFields } from "@/lib/patient-fields";
import { hasRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const where = patientSearchWhere(session, searchParams.get("q"), parseSearchField(searchParams.get("campo")));
  const patients = await prisma.patient.findMany({
    where,
    include: { unit: { select: { name: true } }, _count: { select: { medicalRecords: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return Response.json(patients);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const unitId = typeof body.unitId === "string" ? body.unitId : "";
  if (!unitId) return Response.json({ error: "Informe a unidade" }, { status: 400 });
  const parsed = parsePatientFields(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(unitId)) {
    return Response.json({ error: "Sem permissão para esta unidade" }, { status: 403 });
  }

  const patient = await prisma.patient.create({
    data: { ...(parsed.data as { name: string; species: string; ownerName: string }), unitId },
  });
  const { name, species } = patient;

  await prisma.auditLog.create({
    data: { userId: session.id, action: "CREATE", entity: "Patient", entityId: patient.id, details: JSON.stringify({ name, species }) },
  });

  return Response.json(patient, { status: 201 });
}
