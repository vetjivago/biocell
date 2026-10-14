import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { ALLOWED_MIME, MAX_ATTACHMENT_BYTES } from "@/lib/clinical-types";
import { CHECKLIST_TERMS, getAccessibleOrder } from "@/lib/service-orders";

// Anexa um documento à OS (ex.: termo assinado); campo "file" e opcional "checklistKey"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getAccessibleOrder(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const keyRaw = form?.get("checklistKey");
  const checklistKey = typeof keyRaw === "string" && CHECKLIST_TERMS.some((t) => t.key === keyRaw) ? keyRaw : null;

  if (!(file instanceof File)) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "Arquivo vazio" }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return Response.json({ error: `Arquivo muito grande (máx. ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.test(mimeType)) {
    return Response.json({ error: "Tipo de arquivo não permitido (use PDF, imagem, Word ou Excel)" }, { status: 415 });
  }

  const att = await prisma.serviceOrderAttachment.create({
    data: {
      serviceOrderId: id,
      checklistKey,
      fileName: file.name.slice(0, 200) || "arquivo",
      mimeType,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
      uploadedById: session.id,
    },
    select: { id: true, fileName: true, checklistKey: true, size: true },
  });
  await prisma.auditLog.create({
    data: { userId: session.id, action: "UPLOAD", entity: "ServiceOrderAttachment", entityId: att.id, details: JSON.stringify({ serviceOrderId: id, checklistKey, fileName: att.fileName }) },
  });
  return Response.json(att, { status: 201 });
}
