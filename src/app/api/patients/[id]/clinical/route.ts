import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getGeneralRecordPatient, isEntryType } from "@/lib/clinical";

// Linha do tempo do prontuário geral (sem o conteúdo dos anexos)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const access = await getGeneralRecordPatient(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const entries = await prisma.clinicalEntry.findMany({
    where: { patientId: id },
    orderBy: { occurredAt: "desc" },
    include: {
      author: { select: { name: true } },
      attachments: { select: { id: true, fileName: true, mimeType: true, size: true } },
    },
  });
  return Response.json(entries);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const access = await getGeneralRecordPatient(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { patient } = access;

  const body = await request.json();
  const { type, title, content, weight, occurredAt } = body;
  if (!isEntryType(type)) return Response.json({ error: "Tipo de registro inválido" }, { status: 400 });

  const weightValue = weight === null || weight === undefined || weight === "" ? null : Number(weight);
  if (type === "PESO" && (weightValue === null || !Number.isFinite(weightValue) || weightValue <= 0)) {
    return Response.json({ error: "Informe o peso em kg" }, { status: 400 });
  }
  if (type !== "PESO" && !String(content || "").trim() && !String(title || "").trim()) {
    return Response.json({ error: "Preencha o resumo ou o texto do registro" }, { status: 400 });
  }
  const when = occurredAt ? new Date(occurredAt) : new Date();
  if (Number.isNaN(when.getTime())) return Response.json({ error: "Data inválida" }, { status: 400 });

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.clinicalEntry.create({
      data: {
        patientId: patient.id,
        unitId: patient.unitId,
        authorId: session.id,
        type,
        title: String(title || "").trim() || null,
        content: String(content || ""),
        weight: type === "PESO" ? weightValue : null,
        occurredAt: when,
      },
    });
    // Peso mais recente atualiza a ficha do paciente
    if (type === "PESO" && weightValue) {
      const newer = await tx.clinicalEntry.count({
        where: { patientId: patient.id, type: "PESO", occurredAt: { gt: when } },
      });
      if (newer === 0) await tx.patient.update({ where: { id: patient.id }, data: { weight: weightValue } });
    }
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "CREATE", entity: "ClinicalEntry", entityId: created.id,
        details: JSON.stringify({ patientId: patient.id, type }),
      },
    });
    return created;
  });

  return Response.json(entry, { status: 201 });
}
