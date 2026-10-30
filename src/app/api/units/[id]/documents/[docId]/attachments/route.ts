import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { ALLOWED_MIME, MAX_ATTACHMENT_BYTES, unitAccess } from "@/lib/unit-documents";

// Envio de um anexo por requisição (multipart, campo "file")
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id, docId } = await params;
  const access = await unitAccess(session, id, true);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const doc = await prisma.unitDocument.findFirst({ where: { id: docId, unitId: id }, select: { id: true } });
  if (!doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "Arquivo vazio" }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return Response.json({ error: `Arquivo muito grande (máx. ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.test(mimeType)) {
    return Response.json({ error: "Tipo de arquivo não permitido (use PDF, imagem, Word ou Excel)" }, { status: 415 });
  }
  const data = Buffer.from(await file.arrayBuffer());

  const attachment = await prisma.$transaction(async (tx) => {
    const a = await tx.unitDocumentAttachment.create({
      data: { documentId: docId, fileName: file.name.slice(0, 200) || "arquivo", mimeType, size: file.size, data, uploadedById: session.id },
      select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true },
    });
    await tx.unitDocument.update({ where: { id: docId }, data: { updatedAt: new Date(), updatedById: session.id } });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "UPLOAD", entity: "UnitDocumentAttachment", entityId: a.id,
        details: JSON.stringify({ unitId: id, documentId: docId, fileName: a.fileName, size: a.size }),
      },
    });
    return a;
  });

  return Response.json(attachment, { status: 201 });
}
