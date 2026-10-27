import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canAccessUnit } from "@/lib/patient-search";
import { canEditRecord, checkApplications, cleanPreparedBy, parseApplications, parseThawings, summarize, validateLots } from "@/lib/record-applications";

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

async function loadForChange(id: string) {
  return prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      applications: { include: { items: true }, orderBy: { number: "asc" } },
      thawings: { orderBy: { number: "asc" } },
      serviceOrderApplication: { select: { id: true } },
      _count: { select: { inventoryTransactions: true } },
    },
  });
}

// Edita o prontuário. Aberto: tudo, inclusive lotes. Concluído (já deu baixa): só dados clínicos e datas.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const record = await loadForChange(id);
  if (!record) return Response.json({ error: "Prontuário não encontrado" }, { status: 404 });
  if (!canAccessUnit(session, record.unitId)) return Response.json({ error: "Sem permissão" }, { status: 403 });
  if (!canEditRecord(session, record)) {
    return Response.json({ error: "Só quem registrou, o gestor da unidade ou a matriz podem alterar" }, { status: 403 });
  }

  const body = await request.json();
  const pathology = typeof body.pathology === "string" ? body.pathology.trim().slice(0, 300) : "";
  if (!pathology) return Response.json({ error: "Informe a patologia" }, { status: 400 });
  const text = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
  const protocol = {
    pathology,
    cellQuantity: text(body.cellQuantity),
    applicationRoute: text(body.applicationRoute),
    donors: text(body.donors),
    serumCollected: body.serumCollected === true,
  };
  const thawings = parseThawings(body.thawings);
  const isOpen = record.status === "OPEN" && record._count.inventoryTransactions === 0;

  let apps: ReturnType<typeof parseApplications> = [];
  let batchInfo: Awaited<ReturnType<typeof validateLots>> | null = null;
  if (isOpen) {
    apps = parseApplications(body.applications);
    const appError = checkApplications(apps);
    if (appError) return Response.json({ error: appError }, { status: 400 });
    batchInfo = await validateLots(apps, record.unitId);
    if ("error" in batchInfo) return Response.json({ error: batchInfo.error }, { status: 400 });
  }

  const before = {
    pathology: record.pathology, cellQuantity: record.cellQuantity, applicationRoute: record.applicationRoute,
    donors: record.donors, serumCollected: record.serumCollected,
    applications: record.applications, thawings: record.thawings,
  };

  await prisma.$transaction(async (tx) => {
    await tx.medicalRecord.update({ where: { id }, data: protocol });
    await tx.thawing.deleteMany({ where: { medicalRecordId: id } });
    if (thawings.length) await tx.thawing.createMany({ data: thawings.map((t) => ({ ...t, medicalRecordId: id })) });

    if (isOpen && batchInfo && !("error" in batchInfo)) {
      // Ainda sem baixa: as aplicações são regravadas por inteiro (itens de lote apagados em cascata)
      await tx.application.deleteMany({ where: { medicalRecordId: id } });
      for (const a of apps) {
        await tx.application.create({
          data: {
            medicalRecordId: id,
            number: a.number,
            date: a.date ? new Date(a.date) : null,
            preparedBy: a.preparedBy,
            cells: summarize(a.items, "CELULAS", batchInfo.batchInfo, a.cells),
            serum: summarize(a.items, "SORO", batchInfo.batchInfo, a.serum),
            medium: summarize(a.items, "MEIO", batchInfo.batchInfo, a.medium),
            ...(a.items.length > 0 ? { items: { createMany: { data: a.items } } } : {}),
          },
        });
      }
    } else if (Array.isArray(body.applications)) {
      // Já com baixa: só a data e o responsável pelo preparo podem mudar (lotes ficam como foram baixados)
      for (const a of body.applications as { id?: string; date?: string | null; preparedBy?: string | null }[]) {
        if (!a.id || !record.applications.some((x) => x.id === a.id)) continue;
        await tx.application.update({ where: { id: a.id }, data: { date: a.date ? new Date(a.date) : null, preparedBy: cleanPreparedBy(a.preparedBy) } });
      }
    }

    await tx.auditLog.create({
      data: { userId: session.id, action: "UPDATE", entity: "MedicalRecord", entityId: id, details: JSON.stringify({ before, lotsEditable: isOpen }) },
    });
  });

  return Response.json({ ok: true, lotsEditable: isOpen });
}

// Exclui o prontuário (só se ainda não deu baixa no estoque). O conteúdo fica guardado no log de auditoria.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const record = await loadForChange(id);
  if (!record) return Response.json({ error: "Prontuário não encontrado" }, { status: 404 });
  if (!canAccessUnit(session, record.unitId)) return Response.json({ error: "Sem permissão" }, { status: 403 });
  if (!canEditRecord(session, record)) {
    return Response.json({ error: "Só quem registrou, o gestor da unidade ou a matriz podem excluir" }, { status: 403 });
  }
  if (record.status === "COMPLETED" || record._count.inventoryTransactions > 0) {
    return Response.json({ error: "Prontuário concluído (já deu baixa no estoque) não pode ser excluído. Corrija pela edição." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // Se veio de uma OS, a aplicação volta para "em preparo"
    if (record.serviceOrderApplication) {
      await tx.serviceOrderApplication.update({
        where: { id: record.serviceOrderApplication.id },
        data: { medicalRecordId: null, status: "IN_PREP" },
      });
    }
    await tx.application.deleteMany({ where: { medicalRecordId: id } });
    await tx.thawing.deleteMany({ where: { medicalRecordId: id } });
    await tx.procedure.deleteMany({ where: { medicalRecordId: id } });
    await tx.followUpContact.deleteMany({ where: { medicalRecordId: id } });
    await tx.medicalRecord.delete({ where: { id } });
    await tx.auditLog.create({
      data: { userId: session.id, action: "DELETE", entity: "MedicalRecord", entityId: id, details: JSON.stringify({ snapshot: record }) },
    });
  });

  return Response.json({ ok: true, patientId: record.patientId });
}
