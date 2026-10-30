import { prisma } from "./prisma";
import { hasRole, seesAllUnits } from "./roles";

// Rastreabilidade de um lote (recall): por onde passou, quanto sobrou e em quais pacientes foi usado.
// O lote é único por número + produto; cada unidade tem seus lançamentos no ledger.

type Session = { role: string; unitIds: string[] };

// Quem consulta: a matriz e a logística veem todas as unidades; o gestor, só as suas
export function canTraceBatches(role: string) {
  return hasRole(role, "ADMIN", "STOCK", "UNIT_MANAGER");
}

// Pacientes e tutores só para quem tem acesso aos prontuários (a logística vê só a contagem)
export function canSeeTracePatients(role: string) {
  return hasRole(role, "ADMIN", "UNIT_MANAGER");
}

const OUT_TYPES = ["DISCARD", "ADJUSTMENT", "TRANSFER_OUT"];

export async function traceBatch(batchId: string, session: Session) {
  const allUnits = seesAllUnits(session.role);
  const unitFilter = allUnits ? {} : { unitId: { in: session.unitIds } };

  const batch = await prisma.cellBatch.findUnique({
    where: { id: batchId },
    include: { product: { select: { name: true, category: true, species: true } } },
  });
  if (!batch) return null;

  const [transactions, items] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: { batchId, ...unitFilter },
      include: {
        unit: { select: { id: true, name: true, city: true, state: true } },
        medicalRecord: { select: { id: true, serialNumber: true, patient: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.applicationItem.findMany({
      where: { batchId, application: { medicalRecord: unitFilter } },
      include: { application: { select: { number: true, date: true, medicalRecordId: true } } },
    }),
  ]);
  // Gestor sem nenhum lançamento do lote nas suas unidades não enxerga o lote
  if (!allUnits && transactions.length === 0 && items.length === 0) return null;

  const reversed = new Set(
    (await prisma.auditLog.findMany({
      where: { action: "REVERSAL", entity: "InventoryTransaction", entityId: { in: transactions.filter((t) => t.type === "RECEIPT").map((t) => t.id) } },
      select: { entityId: true },
    })).map((a) => a.entityId),
  );

  // Por unidade: recebido, usado em prontuários, outras saídas (descarte, ajuste, estorno) e saldo
  const unitMap = new Map<string, { id: string; name: string; city: string; state: string; received: number; consumed: number; otherOut: number; balance: number; firstReceipt: Date | null; patients: Set<string> }>();
  for (const t of transactions) {
    const u = unitMap.get(t.unitId) ?? { ...t.unit, received: 0, consumed: 0, otherOut: 0, balance: 0, firstReceipt: null, patients: new Set<string>() };
    if (t.quantity > 0) {
      u.received += t.quantity;
      if (!u.firstReceipt) u.firstReceipt = t.createdAt;
    } else if (t.type === "CONSUMPTION") u.consumed -= t.quantity;
    else if (OUT_TYPES.includes(t.type) || t.quantity < 0) u.otherOut -= t.quantity;
    u.balance += t.quantity;
    unitMap.set(t.unitId, u);
  }

  // Prontuários: lotes informados nas aplicações + baixas antigas lançadas direto no prontuário
  const recordIds = [...new Set([
    ...items.map((i) => i.application.medicalRecordId),
    ...transactions.flatMap((t) => (t.medicalRecordId ? [t.medicalRecordId] : [])),
  ])];
  const records = recordIds.length
    ? await prisma.medicalRecord.findMany({
        where: { id: { in: recordIds } },
        select: {
          id: true, serialNumber: true, status: true, pathology: true, createdAt: true, completedAt: true,
          unit: { select: { id: true, name: true, city: true, state: true } },
          professional: { select: { name: true } },
          patient: { select: { id: true, name: true, species: true, breed: true, ownerName: true, ownerPhone: true, ownerEmail: true } },
        },
      })
    : [];

  const uses = records
    .map((r) => {
      const apps = items
        .filter((i) => i.application.medicalRecordId === r.id)
        .sort((a, b) => a.application.number - b.application.number)
        .map((i) => ({ number: i.application.number, date: i.application.date, quantity: i.quantity }));
      const consumed = -transactions.filter((t) => t.medicalRecordId === r.id && t.type === "CONSUMPTION").reduce((s, t) => s + t.quantity, 0);
      const firstUse = apps.find((a) => a.date)?.date ?? r.completedAt ?? r.createdAt;
      return { ...r, applications: apps, quantity: consumed || apps.reduce((s, a) => s + a.quantity, 0), consumed: consumed > 0, firstUse };
    })
    .sort((a, b) => b.firstUse.getTime() - a.firstUse.getTime());

  // Unidade pode ter usado o lote em prontuário sem ainda ter lançamento (prontuário aberto)
  for (const r of uses) {
    const u = unitMap.get(r.unit.id) ?? { ...r.unit, received: 0, consumed: 0, otherOut: 0, balance: 0, firstReceipt: null, patients: new Set<string>() };
    u.patients.add(r.patient.id);
    unitMap.set(r.unit.id, u);
  }
  const units = [...unitMap.values()]
    .map(({ patients, ...u }) => ({ ...u, patients: patients.size }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sum = (f: (u: (typeof units)[number]) => number) => units.reduce((s, u) => s + f(u), 0);
  return {
    batch,
    units,
    uses,
    timeline: transactions.map((t) => ({ ...t, reversed: reversed.has(t.id) })),
    totals: {
      received: sum((u) => u.received),
      consumed: sum((u) => u.consumed),
      otherOut: sum((u) => u.otherOut),
      balance: sum((u) => u.balance),
      units: units.length,
      unitsWithBalance: units.filter((u) => u.balance > 0).length,
      patients: new Set(uses.map((r) => r.patient.id)).size,
      openRecords: uses.filter((r) => r.status !== "COMPLETED").length,
    },
  };
}

export type BatchTrace = NonNullable<Awaited<ReturnType<typeof traceBatch>>>;
