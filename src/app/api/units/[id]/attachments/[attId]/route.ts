import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canSeeDocument, unitAccess } from "@/lib/unit-documents";

type Ctx = { params: Promise<{ id: string; attId: string }> };

// Abre/baixa o anexo de um documento da unidade (?download=1 força download)
export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id, attId } = await params;
  const access = await unitAccess(session, id, false);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const att = await prisma.unitDocumentAttachment.findFirst({
    where: { id: attId, document: { unitId: id } },
    include: { document: { select: { visibility: true } } },
  });
  if (!att || !canSeeDocument(access.canEdit, att.document.visibility)) return Response.json({ error: "Anexo não encontrado" }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  // Imagens e PDF abrem no navegador; o resto é sempre baixado
  const inline = !download && /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/.test(att.mimeType);
  return new Response(new Uint8Array(att.data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      "Content-Length": String(att.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id, attId } = await params;
  const access = await unitAccess(session, id, true);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const att = await prisma.unitDocumentAttachment.findFirst({
    where: { id: attId, document: { unitId: id } },
    select: { id: true, fileName: true, documentId: true },
  });
  if (!att) return Response.json({ error: "Anexo não encontrado" }, { status: 404 });

  await prisma.$transaction([
    prisma.unitDocumentAttachment.delete({ where: { id: attId } }),
    prisma.unitDocument.update({ where: { id: att.documentId }, data: { updatedAt: new Date(), updatedById: session.id } }),
    prisma.auditLog.create({
      data: {
        userId: session.id, action: "DELETE", entity: "UnitDocumentAttachment", entityId: attId,
        details: JSON.stringify({ unitId: id, documentId: att.documentId, fileName: att.fileName }),
      },
    }),
  ]);
  return Response.json({ ok: true });
}
