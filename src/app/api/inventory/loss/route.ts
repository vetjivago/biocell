import { prisma } from "@/lib/prisma";
import { canRegisterLoss, seesAllUnits } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { MAX_ATTACHMENT_BYTES } from "@/lib/clinical-types";
import { LOSS_CAUSES, LOSS_TYPE, MAX_LOSS_PHOTOS } from "@/lib/stock-loss";
import { syncLowStockAlert } from "@/lib/stock-alerts";

// Baixa por perda (palheta estourada/quebrada): tira do saldo do lote e guarda a foto junto.
// Formulário (multipart): unitId, batchId, quantity, cause, notes e uma ou mais fotos em "file"
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canRegisterLoss(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Envio inválido (as fotos podem ter passado do tamanho máximo)" }, { status: 400 });

  const unitId = String(form.get("unitId") ?? "");
  const batchId = String(form.get("batchId") ?? "");
  const quantity = Number(form.get("quantity"));
  const cause = String(form.get("cause") ?? "");
  const notes = String(form.get("notes") ?? "").trim().slice(0, 300);

  if (!unitId || !batchId) return Response.json({ error: "Informe a unidade e o lote" }, { status: 400 });
  if (!seesAllUnits(session.role) && !session.unitIds.includes(unitId)) {
    return Response.json({ error: "Sem permissão nesta unidade" }, { status: 403 });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) return Response.json({ error: "Informe a quantidade perdida" }, { status: 400 });
  if (!(LOSS_CAUSES as readonly string[]).includes(cause)) return Response.json({ error: "Escolha o motivo" }, { status: 400 });
  if (cause === "Outro" && !notes) return Response.json({ error: "Descreva o que aconteceu" }, { status: 400 });

  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return Response.json({ error: "Anexe a foto da palheta quebrada" }, { status: 400 });
  if (files.length > MAX_LOSS_PHOTOS) return Response.json({ error: `Envie no máximo ${MAX_LOSS_PHOTOS} fotos` }, { status: 400 });
  if (files.some((f) => !(f.type || "").startsWith("image/"))) return Response.json({ error: "A foto precisa ser uma imagem" }, { status: 415 });
  if (files.reduce((t, f) => t + f.size, 0) > MAX_ATTACHMENT_BYTES) {
    return Response.json({ error: `Fotos muito grandes (máx. ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB no total)` }, { status: 413 });
  }

  const batch = await prisma.cellBatch.findUnique({ where: { id: batchId }, select: { id: true } });
  if (!batch) return Response.json({ error: "Lote não encontrado" }, { status: 404 });

  const photos = await Promise.all(files.map(async (f) => ({
    fileName: f.name.slice(0, 200) || "foto",
    mimeType: f.type,
    size: f.size,
    data: Buffer.from(await f.arrayBuffer()),
    uploadedById: session.id,
  })));
  const reason = notes ? `${cause} – ${notes}` : cause;

  // Saldo conferido e baixa gravada na mesma transação (junto com as fotos)
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.inventoryTransaction.aggregate({ where: { unitId, batchId }, _sum: { quantity: true } });
    const balance = current._sum.quantity || 0;
    if (balance < quantity) return { error: `Saldo insuficiente: o lote tem ${balance} nesta unidade` };
    const transaction = await tx.inventoryTransaction.create({
      data: {
        unitId, batchId, type: LOSS_TYPE, quantity: -quantity, balance: balance - quantity,
        reason, performedBy: session.name,
        lossPhotos: { create: photos },
      },
      select: { id: true, balance: true },
    });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: LOSS_TYPE, entity: "InventoryTransaction", entityId: transaction.id,
        details: JSON.stringify({ unitId, batchId, quantity, cause, notes, photos: photos.length, newBalance: transaction.balance }),
      },
    });
    return { transaction };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });

  await syncLowStockAlert(unitId);
  return Response.json(result.transaction, { status: 201 });
}
