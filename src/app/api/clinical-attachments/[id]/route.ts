import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getGeneralRecordPatient } from "@/lib/clinical";

// Abre/baixa o anexo (?download=1 força download)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const att = await prisma.clinicalAttachment.findUnique({
    where: { id },
    include: { entry: { select: { patientId: true } } },
  });
  if (!att) return Response.json({ error: "Anexo não encontrado" }, { status: 404 });
  const access = await getGeneralRecordPatient(session, att.entry.patientId);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const download = new URL(request.url).searchParams.get("download") === "1";
  // Só imagens e PDF abrem no navegador; o resto é sempre baixado
  const inline = !download && /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/.test(att.mimeType);
  const encodedName = encodeURIComponent(att.fileName);

  return new Response(new Uint8Array(att.data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(att.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
