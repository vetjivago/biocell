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
  // Imagens, PDF e vídeo abrem no navegador; o resto é sempre baixado
  const inline = !download && /^(image\/(png|jpeg|gif|webp)|application\/pdf|video\/(mp4|webm|quicktime))$/.test(att.mimeType);
  const encodedName = encodeURIComponent(att.fileName);

  const headers = {
    "Content-Type": att.mimeType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  // Vídeo no iPhone (Safari) exige respostas parciais (Range)
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const total = att.data.length;
    let start = range[1] ? Number(range[1]) : NaN;
    let end = range[2] ? Number(range[2]) : total - 1;
    if (Number.isNaN(start)) { start = Math.max(0, total - end); end = total - 1; } // bytes=-N (últimos N)
    end = Math.min(end, total - 1);
    if (start > end || start >= total) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${total}` } });
    }
    return new Response(new Uint8Array(att.data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(new Uint8Array(att.data), { headers: { ...headers, "Content-Length": String(att.size) } });
}
