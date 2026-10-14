import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canAccessUnit } from "@/lib/patient-search";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      patient: true,
      unit: { select: { id: true, name: true } },
      professional: { select: { name: true } },
      applications: {
        orderBy: { number: "asc" },
        include: { items: { include: { batch: { include: { product: { select: { name: true } } } } } } },
      },
      thawings: { orderBy: { number: "asc" } },
      inventoryTransactions: {
        include: { batch: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  if (!record) return Response.json({ error: "Prontuário não encontrado" }, { status: 404 });
  if (!canAccessUnit(session, record.unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Lotes escolhidos nas aplicações, somados por lote (pré-preenchimento da baixa)
  const planned = new Map<string, { batchId: string; category: string; quantity: number }>();
  for (const it of record.applications.flatMap((a) => a.items)) {
    const prev = planned.get(it.batchId);
    planned.set(it.batchId, { batchId: it.batchId, category: it.category, quantity: (prev?.quantity || 0) + it.quantity });
  }

  return Response.json({ ...record, plannedItems: [...planned.values()] });
}
