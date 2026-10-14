import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getAccessibleOrder } from "@/lib/service-orders";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const att = await prisma.serviceOrderAttachment.findUnique({ where: { id } });
  if (!att) return Response.json({ error: "Anexo não encontrado" }, { status: 404 });
  const access = await getAccessibleOrder(session, att.serviceOrderId);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

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
