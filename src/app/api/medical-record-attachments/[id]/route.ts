import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canAccessUnit } from "@/lib/patient-search";
import { canEditRecord } from "@/lib/record-applications";

async function load(id: string) {
  return prisma.medicalRecordAttachment.findUnique({
    where: { id },
    include: { medicalRecord: { select: { unitId: true, professionalId: true, status: true, _count: { select: { attachments: true } } } } },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const att = await load(id);
  if (!att) return Response.json({ error: "Anexo não encontrado" }, { status: 404 });
  if (!canAccessUnit(session, att.medicalRecord.unitId)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const inline = !download && /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/.test(att.mimeType);
  return new Response(new Uint8Array(att.data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(att.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Remove a foto; prontuário concluído precisa continuar com ao menos uma
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const att = await load(id);
  if (!att) return Response.json({ error: "Anexo não encontrado" }, { status: 404 });
  const record = att.medicalRecord;
  if (!canAccessUnit(session, record.unitId) || !canEditRecord(session, record)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (record.status === "COMPLETED" && record._count.attachments <= 1) {
    return Response.json({ error: "O prontuário concluído precisa manter ao menos uma foto das palhetas" }, { status: 400 });
  }
  await prisma.medicalRecordAttachment.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: session.id, action: "DELETE", entity: "MedicalRecordAttachment", entityId: id, details: JSON.stringify({ medicalRecordId: att.medicalRecordId, fileName: att.fileName }) },
  });
  return Response.json({ ok: true });
}
