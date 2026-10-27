import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getGeneralRecordPatient } from "@/lib/clinical";
import { parseQuoteFields } from "@/lib/sales";
import { NextRequest } from "next/server";

// Cria o orçamento do paciente
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const access = await getGeneralRecordPatient(session, String(body.patientId || ""));
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { patient } = access;

  const parsed = parseQuoteFields(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { items = [], ...fields } = parsed.data;

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        ...fields,
        patientId: patient.id,
        unitId: patient.unitId,
        createdById: session.id,
        items: { create: items.map((i, position) => ({ ...i, position })) },
      },
    });
    await tx.auditLog.create({
      data: { userId: session.id, action: "CREATE", entity: "Sale", entityId: created.id, details: JSON.stringify({ number: created.number, patientId: patient.id }) },
    });
    return created;
  });

  return Response.json(sale, { status: 201 });
}
