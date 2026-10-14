import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canEditEntry, getGeneralRecordPatient } from "@/lib/clinical";

async function loadEntry(entryId: string) {
  return prisma.clinicalEntry.findUnique({
    where: { id: entryId },
    include: {
      author: { select: { name: true } },
      attachments: { select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { entryId } = await params;

  const entry = await loadEntry(entryId);
  if (!entry) return Response.json({ error: "Registro não encontrado" }, { status: 404 });
  const access = await getGeneralRecordPatient(session, entry.patientId);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  return Response.json({ ...entry, canEdit: canEditEntry(session, entry) });
}

// Edição mantém o histórico no log de auditoria (o conteúdo anterior fica registrado)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { entryId } = await params;

  const entry = await loadEntry(entryId);
  if (!entry) return Response.json({ error: "Registro não encontrado" }, { status: 404 });
  const access = await getGeneralRecordPatient(session, entry.patientId);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  if (!canEditEntry(session, entry)) return Response.json({ error: "Só o autor ou o gestor podem editar" }, { status: 403 });

  const { title, content, weight, occurredAt } = await request.json();
  const data: { title?: string | null; content?: string; weight?: number | null; occurredAt?: Date } = {};
  if (title !== undefined) data.title = String(title || "").trim() || null;
  if (content !== undefined) data.content = String(content || "");
  if (entry.type === "PESO" && weight !== undefined) {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return Response.json({ error: "Informe o peso em kg" }, { status: 400 });
    data.weight = w;
  }
  if (occurredAt !== undefined) {
    const d = new Date(occurredAt);
    if (Number.isNaN(d.getTime())) return Response.json({ error: "Data inválida" }, { status: 400 });
    data.occurredAt = d;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.clinicalEntry.update({ where: { id: entryId }, data });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "UPDATE", entity: "ClinicalEntry", entityId: entryId,
        details: JSON.stringify({
          before: { title: entry.title, content: entry.content, weight: entry.weight, occurredAt: entry.occurredAt },
        }),
      },
    });
    return u;
  });

  return Response.json(updated);
}
