import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { MAX_ATTACHMENT_BYTES } from "@/lib/clinical-types";
import { canAccessUnit } from "@/lib/patient-search";

// Anexa uma foto das palhetas ao prontuário (campo "file"; imagem ou PDF)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const record = await prisma.medicalRecord.findUnique({ where: { id }, select: { unitId: true } });
  if (!record) return Response.json({ error: "Prontuário não encontrado" }, { status: 404 });
  if (!canAccessUnit(session, record.unitId)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "Arquivo vazio" }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return Response.json({ error: `Arquivo muito grande (máx. ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }
  const mimeType = file.type || "application/octet-stream";
  if (!/^(image\/|application\/pdf$)/.test(mimeType)) {
    return Response.json({ error: "Envie uma foto (imagem) ou PDF" }, { status: 415 });
  }

  const att = await prisma.medicalRecordAttachment.create({
    data: {
      medicalRecordId: id,
      fileName: file.name.slice(0, 200) || "foto",
      mimeType,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
      uploadedById: session.id,
    },
    select: { id: true, fileName: true, mimeType: true },
  });
  await prisma.auditLog.create({
    data: { userId: session.id, action: "UPLOAD", entity: "MedicalRecordAttachment", entityId: att.id, details: JSON.stringify({ medicalRecordId: id, fileName: att.fileName }) },
  });
  return Response.json(att, { status: 201 });
}
