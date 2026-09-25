import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { name, species, breed, weight, ownerName, ownerPhone, ownerEmail, veterinarian, clinic, unitId } = body;

  if (!name || !species || !ownerName || !unitId) {
    return Response.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  if (session.role !== "ADMIN" && !session.unitIds.includes(unitId)) {
    return Response.json({ error: "Sem permissão para esta unidade" }, { status: 403 });
  }

  const patient = await prisma.patient.create({
    data: { name, species, breed, weight, ownerName, ownerPhone, ownerEmail, veterinarian, clinic, unitId },
  });

  await prisma.auditLog.create({
    data: { userId: session.id, action: "CREATE", entity: "Patient", entityId: patient.id, details: JSON.stringify({ name, species }) },
  });

  return Response.json(patient, { status: 201 });
}
