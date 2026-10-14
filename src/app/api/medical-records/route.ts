import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const unitId = searchParams.get("unitId");

  const isAdmin = session.role === "ADMIN";
  const where = {
    ...(isAdmin ? {} : { unitId: { in: session.unitIds } }),
    ...(status ? { status } : {}),
    ...(unitId ? { unitId } : {}),
  };

  const records = await prisma.medicalRecord.findMany({
    where,
    include: {
      patient: true,
      unit: { select: { name: true } },
      professional: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(records);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const {
    patientId: existingPatientId,
    pathology, cellQuantity, applicationRoute,
    donors, serumCollected, applications, thawings,
  } = body;

  if (!existingPatientId) {
    return Response.json({ error: "Selecione um paciente. Novos prontuários são abertos pela aba Pacientes." }, { status: 400 });
  }

  if (!pathology) {
    return Response.json({ error: "Campos obrigatórios faltando (patologia)" }, { status: 400 });
  }

  const existingPatient = await prisma.patient.findUnique({ where: { id: existingPatientId }, select: { unitId: true, name: true } });
  if (!existingPatient) {
    return Response.json({ error: "Paciente não encontrado" }, { status: 404 });
  }
  const unitId = existingPatient.unitId;

  if (session.role !== "ADMIN" && !session.unitIds.includes(unitId)) {
    return Response.json({ error: "Sem permissão para esta unidade" }, { status: 403 });
  }

  type AppItemInput = { batchId?: string; category?: string; quantity?: number | string };
  type AppInput = { number: number; date?: string; cells?: string; serum?: string; medium?: string; items?: AppItemInput[] };

  const parsedApps = ((applications || []) as AppInput[]).map((a) => ({
    ...a,
    items: (a.items || [])
      .filter((i) => i.batchId && Number(i.quantity) > 0)
      .map((i) => ({ batchId: i.batchId as string, category: i.category || "CELULAS", quantity: Math.floor(Number(i.quantity)) })),
  }));
  const validApps = parsedApps.filter((a) => a.date || a.cells || a.items.length > 0);

  // Lotes precisam estar no estoque da unidade, ser da categoria certa e ter saldo suficiente
  const requestedByBatch = new Map<string, number>();
  for (const item of validApps.flatMap((a) => a.items)) {
    requestedByBatch.set(item.batchId, (requestedByBatch.get(item.batchId) || 0) + item.quantity);
  }
  const batchInfo = new Map<string, { batchNumber: string; category: string; productName: string }>();
  if (requestedByBatch.size > 0) {
    const batchIds = [...requestedByBatch.keys()];
    const [batches, balances] = await Promise.all([
      prisma.cellBatch.findMany({
        where: { id: { in: batchIds } },
        include: { product: { select: { name: true, category: true } } },
      }),
      prisma.inventoryTransaction.groupBy({
        by: ["batchId"],
        _sum: { quantity: true },
        where: { unitId, batchId: { in: batchIds } },
      }),
    ]);
    for (const b of batches) {
      batchInfo.set(b.id, { batchNumber: b.batchNumber, category: b.product.category, productName: b.product.name });
    }
    const balanceMap = new Map(balances.map((b) => [b.batchId, b._sum.quantity || 0]));
    for (const item of validApps.flatMap((a) => a.items)) {
      const info = batchInfo.get(item.batchId);
      if (!info || info.category !== item.category) {
        return Response.json({ error: "Lote inválido selecionado na aplicação" }, { status: 400 });
      }
    }
    for (const [batchId, qty] of requestedByBatch) {
      const available = balanceMap.get(batchId) || 0;
      if (qty > available) {
        const info = batchInfo.get(batchId)!;
        return Response.json({
          error: `Estoque insuficiente do lote ${info.batchNumber} (${info.productName}). Disponível: ${available}, solicitado: ${qty}`,
        }, { status: 400 });
      }
    }
  }

  // Resumo em texto (mantém compatibilidade com a exibição/impressão existente)
  function summarize(items: { batchId: string; category: string; quantity: number }[], category: string, fallback?: string) {
    const rows = items.filter((i) => i.category === category);
    if (rows.length === 0) return fallback || null;
    return rows.map((i) => `${i.quantity} (lote ${batchInfo.get(i.batchId)?.batchNumber})`).join(" + ");
  }

  const validThawings = (thawings || []).filter(
    (t: { thawedStraws?: number | string; thawedMeio?: number | string; thawedSoro?: number | string; retrievalLocation?: string }) =>
      (t.thawedStraws && Number(t.thawedStraws) > 0) || (t.thawedMeio && Number(t.thawedMeio) > 0) || (t.thawedSoro && Number(t.thawedSoro) > 0) || t.retrievalLocation
  );

  try {
    const record = await prisma.$transaction(async (tx) => {
      const mr = await tx.medicalRecord.create({
        data: {
          patientId: existingPatientId,
          unitId,
          professionalId: session.id,
          pathology,
          cellQuantity: cellQuantity || null,
          applicationRoute: applicationRoute || null,
          donors: donors || null,
          serumCollected: serumCollected || false,
          ...(validThawings.length > 0
            ? {
                thawings: {
                  createMany: {
                    data: validThawings.map((t: { number: number; thawedStraws?: number | string; thawedMeio?: number | string; thawedSoro?: number | string; retrievalLocation?: string }) => ({
                      number: t.number,
                      thawedStraws: t.thawedStraws ? Number(t.thawedStraws) : null,
                      thawedMeio: t.thawedMeio ? Number(t.thawedMeio) : null,
                      thawedSoro: t.thawedSoro ? Number(t.thawedSoro) : null,
                      retrievalLocation: t.retrievalLocation || null,
                    })),
                  },
                },
              }
            : {}),
        },
        include: { patient: true },
      });

      for (const a of validApps) {
        await tx.application.create({
          data: {
            medicalRecordId: mr.id,
            number: a.number,
            date: a.date ? new Date(a.date) : null,
            cells: summarize(a.items, "CELULAS", a.cells),
            serum: summarize(a.items, "SORO", a.serum),
            medium: summarize(a.items, "MEIO", a.medium),
            ...(a.items.length > 0 ? { items: { createMany: { data: a.items } } } : {}),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "CREATE",
          entity: "MedicalRecord",
          entityId: mr.id,
          details: JSON.stringify({ patientName: existingPatient.name, pathology }),
        },
      });

      return mr;
    });

    return Response.json(record, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar prontuário:", err);
    return Response.json({ error: "Erro ao registrar prontuário" }, { status: 500 });
  }
}
