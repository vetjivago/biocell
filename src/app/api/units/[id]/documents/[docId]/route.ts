import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { docName, docNotes, parseDueDate, parseVisibility, unitAccess } from "@/lib/unit-documents";

type Ctx = { params: Promise<{ id: string; docId: string }> };

// Edita anotação, vencimento, permissão (e o nome, nos documentos que não são padrão)
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id, docId } = await params;
  const access = await unitAccess(session, id, true);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const doc = await prisma.unitDocument.findFirst({ where: { id: docId, unitId: id } });
  if (!doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; notes?: string | null; dueDate?: Date | null; visibility?: string } = {};
  if ("name" in body && doc.kind === "OTHER") {
    data.name = docName(body.name);
    if (!data.name) return Response.json({ error: "Informe o nome do documento" }, { status: 400 });
  }
  if ("notes" in body) data.notes = docNotes(body.notes);
  if ("dueDate" in body) {
    const dueDate = parseDueDate(body.dueDate);
    if (dueDate === undefined) return Response.json({ error: "Data de vencimento inválida" }, { status: 400 });
    data.dueDate = dueDate;
  }
  if ("visibility" in body) {
    const visibility = parseVisibility(body.visibility);
    if (!visibility) return Response.json({ error: "Permissão inválida" }, { status: 400 });
    data.visibility = visibility;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.unitDocument.update({ where: { id: docId }, data: { ...data, updatedAt: new Date(), updatedById: session.id } });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "UPDATE", entity: "UnitDocument", entityId: docId,
        details: JSON.stringify({ unitId: id, changed: data, before: { name: doc.name, notes: doc.notes, dueDate: doc.dueDate, visibility: doc.visibility } }),
      },
    });
    return u;
  });
  return Response.json(updated);
}

// Apaga um documento que não é padrão (com os anexos)
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id, docId } = await params;
  const access = await unitAccess(session, id, true);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const doc = await prisma.unitDocument.findFirst({ where: { id: docId, unitId: id }, include: { _count: { select: { attachments: true } } } });
  if (!doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
  if (doc.kind !== "OTHER") return Response.json({ error: "Os documentos padrão não podem ser apagados" }, { status: 400 });

  await prisma.$transaction([
    prisma.unitDocument.delete({ where: { id: docId } }),
    prisma.auditLog.create({
      data: { userId: session.id, action: "DELETE", entity: "UnitDocument", entityId: docId, details: JSON.stringify({ unitId: id, name: doc.name, attachments: doc._count.attachments }) },
    }),
  ]);
  return Response.json({ ok: true });
}
