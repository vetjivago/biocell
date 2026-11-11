import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { seesAllUnits } from "@/lib/roles";
import { NextRequest } from "next/server";

// Abre a foto da baixa por perda (quem enxerga o estoque da unidade)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const photo = await prisma.inventoryLossPhoto.findUnique({
    where: { id },
    include: { transaction: { select: { unitId: true } } },
  });
  if (!photo) return Response.json({ error: "Foto não encontrada" }, { status: 404 });
  if (!seesAllUnits(session.role) && !session.unitIds.includes(photo.transaction.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }
  const inline = /^image\/(png|jpeg|gif|webp)$/.test(photo.mimeType);
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(photo.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
