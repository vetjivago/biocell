import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { ALLOWED_MIME, canEditEntry, getGeneralRecordPatient, MAX_ATTACHMENT_BYTES } from "@/lib/clinical";

// Envio de um anexo por requisição (multipart, campo "file")
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { entryId } = await params;

  const entry = await prisma.clinicalEntry.findUnique({ where: { id: entryId }, select: { id: true, patientId: true, authorId: true } });
  if (!entry) return Response.json({ error: "Registro não encontrado" }, { status: 404 });
  const access = await getGeneralRecordPatient(session, entry.patientId);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  if (!canEditEntry(session, entry)) return Response.json({ error: "Sem permissão para anexar neste registro" }, { status: 403 });

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

  const attachment = await prisma.clinicalAttachment.create({
    data: {
      entryId,
      fileName: file.name.slice(0, 200) || "arquivo",
      mimeType,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
      uploadedById: session.id,
    },
    select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id, action: "UPLOAD", entity: "ClinicalAttachment", entityId: attachment.id,
      details: JSON.stringify({ entryId, fileName: attachment.fileName, size: attachment.size }),
    },
  });

  return Response.json(attachment, { status: 201 });
}
