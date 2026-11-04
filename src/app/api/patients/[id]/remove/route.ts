import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { syncLowStockAlert } from "@/lib/stock-alerts";
import { NextRequest } from "next/server";

// Remoção de paciente — só a matriz (perfil ADMIN):
//   archive  → oculta: some de listas, buscas e totais; todo o histórico fica no banco
//   restore  → desfaz o "ocultar"
//   empty    → apaga de vez, só se não tiver prontuário, OS, venda nem registro clínico
//   all      → apaga paciente e todo o histórico; as baixas de estoque são estornadas
type Mode = "archive" | "restore" | "empty" | "all";
const MODES: Mode[] = ["archive", "restore", "empty", "all"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!hasRole(session.role, "ADMIN")) return Response.json({ error: "Só a matriz pode remover pacientes" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode as Mode;
  if (!MODES.includes(mode)) return Response.json({ error: "Opção inválida" }, { status: 400 });

  const patient = await prisma.patient.findUnique({
    where: { id },
    select: {
      id: true, name: true, ownerName: true, species: true, unitId: true, archivedAt: true,
      _count: { select: { medicalRecords: true, serviceOrders: true, sales: true, clinicalEntries: true } },
    },
  });
  if (!patient) return Response.json({ error: "Paciente não encontrado" }, { status: 404 });

  const snapshot = { name: patient.name, ownerName: patient.ownerName, species: patient.species, unitId: patient.unitId, counts: patient._count };

  if (mode === "archive" || mode === "restore") {
    const archivedAt = mode === "archive" ? new Date() : null;
    await prisma.$transaction([
      prisma.patient.update({ where: { id }, data: { archivedAt } }),
      prisma.auditLog.create({
        data: { userId: session.id, action: mode === "archive" ? "ARCHIVE" : "RESTORE", entity: "Patient", entityId: id, details: JSON.stringify(snapshot) },
      }),
    ]);
    return Response.json({ ok: true, mode });
  }

  if (mode === "empty") {
    const c = patient._count;
    const linked = [
      c.medicalRecords && `${c.medicalRecords} prontuário(s)`,
      c.serviceOrders && `${c.serviceOrders} OS`,
      c.sales && `${c.sales} orçamento(s)/venda(s)`,
      c.clinicalEntries && `${c.clinicalEntries} registro(s) clínico(s)`,
    ].filter(Boolean);
    if (linked.length) {
      return Response.json({ error: `O paciente tem ${linked.join(", ")}. Use "Ocultar" ou "Apagar tudo".` }, { status: 409 });
    }
    await prisma.$transaction([
      prisma.patient.delete({ where: { id } }),
      prisma.auditLog.create({ data: { userId: session.id, action: "DELETE", entity: "Patient", entityId: id, details: JSON.stringify(snapshot) } }),
    ]);
    return Response.json({ ok: true, mode });
  }

  // Apagar tudo
  const affectedUnits = await prisma.$transaction(async (tx) => {
    const records = await tx.medicalRecord.findMany({ where: { patientId: id }, select: { id: true, serialNumber: true } });
    const recordIds = records.map((r) => r.id);
    const orders = await tx.serviceOrder.findMany({ where: { patientId: id }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);

    // Estoque: o que os prontuários movimentaram volta para a unidade (lançamento de ajuste).
    // Os lançamentos originais ficam no histórico, só perdem o vínculo com o prontuário.
    const linkedTx = await tx.inventoryTransaction.findMany({
      where: { medicalRecordId: { in: recordIds } },
      select: { unitId: true, batchId: true, quantity: true },
    });
    const net = new Map<string, { unitId: string; batchId: string; quantity: number }>();
    for (const t of linkedTx) {
      const key = `${t.unitId}|${t.batchId}`;
      const cur = net.get(key) ?? { unitId: t.unitId, batchId: t.batchId, quantity: 0 };
      cur.quantity += t.quantity;
      net.set(key, cur);
    }
    const reason = `Estorno: paciente "${patient.name}" (${patient.ownerName}) excluído pela matriz`;
    for (const n of net.values()) {
      if (n.quantity === 0) continue;
      const current = await tx.inventoryTransaction.aggregate({ where: { unitId: n.unitId, batchId: n.batchId }, _sum: { quantity: true } });
      const balance = (current._sum.quantity || 0) - n.quantity;
      await tx.inventoryTransaction.create({
        data: { unitId: n.unitId, batchId: n.batchId, type: "ADJUSTMENT", quantity: -n.quantity, balance, reason, performedBy: session.name },
      });
    }
    await tx.inventoryTransaction.updateMany({ where: { medicalRecordId: { in: recordIds } }, data: { medicalRecordId: null } });

    // Prontuários e o que depende deles
    await tx.serviceOrderApplication.updateMany({ where: { medicalRecordId: { in: recordIds } }, data: { medicalRecordId: null } });
    await tx.followUpContact.deleteMany({ where: { medicalRecordId: { in: recordIds } } });
    await tx.application.deleteMany({ where: { medicalRecordId: { in: recordIds } } });
    await tx.thawing.deleteMany({ where: { medicalRecordId: { in: recordIds } } });
    await tx.procedure.deleteMany({ where: { medicalRecordId: { in: recordIds } } });
    await tx.medicalRecord.deleteMany({ where: { id: { in: recordIds } } });

    // OS (aplicações e anexos saem em cascata) e seus alertas
    await tx.alert.deleteMany({ where: { serviceOrderId: { in: orderIds } } });
    await tx.serviceOrder.deleteMany({ where: { id: { in: orderIds } } });

    // Vendas, registros clínicos (itens e anexos em cascata) e o paciente (foto em cascata)
    await tx.sale.deleteMany({ where: { patientId: id } });
    await tx.clinicalEntry.deleteMany({ where: { patientId: id } });
    await tx.patient.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: session.id,
        action: "DELETE_ALL",
        entity: "Patient",
        entityId: id,
        details: JSON.stringify({
          ...snapshot,
          records: records.map((r) => r.serialNumber),
          stockReturned: [...net.values()].filter((n) => n.quantity !== 0).map((n) => ({ ...n, quantity: -n.quantity })),
        }),
      },
    });

    return [...new Set([...net.values()].map((n) => n.unitId))];
  }, { timeout: 60_000 });

  for (const unitId of affectedUnits) await syncLowStockAlert(unitId);

  return Response.json({ ok: true, mode });
}
