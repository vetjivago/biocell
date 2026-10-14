import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { canEditRecord } from "@/lib/record-applications";
import EditRecordForm, { type StockLot } from "./EditRecordForm";

export default async function EditarProntuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      patient: { select: { name: true, species: true } },
      applications: { orderBy: { number: "asc" }, include: { items: true } },
      thawings: { orderBy: { number: "asc" } },
      _count: { select: { inventoryTransactions: true } },
    },
  });
  if (!record) notFound();
  if (session.role !== "ADMIN" && !session.unitIds.includes(record.unitId)) notFound();
  if (!canEditRecord(session, record)) notFound();

  const lotsEditable = record.status === "OPEN" && record._count.inventoryTransactions === 0;

  // Saldos da unidade (só quando os lotes podem ser alterados)
  let stock: StockLot[] = [];
  if (lotsEditable) {
    const grouped = await prisma.inventoryTransaction.groupBy({ by: ["batchId"], _sum: { quantity: true }, where: { unitId: record.unitId } });
    const batches = await prisma.cellBatch.findMany({
      where: { id: { in: grouped.map((g) => g.batchId) } },
      include: { product: { select: { name: true, category: true, species: true } } },
    });
    const bal = new Map(grouped.map((g) => [g.batchId, g._sum.quantity || 0]));
    stock = batches
      .map((b) => ({ batchId: b.id, batchNumber: b.batchNumber, productName: b.product.name, category: b.product.category, species: b.product.species, balance: bal.get(b.id) || 0 }))
      .filter((l) => l.balance > 0)
      .sort((a, b) => a.productName.localeCompare(b.productName) || a.batchNumber.localeCompare(b.batchNumber));
  }

  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <div className="max-w-3xl">
      <Link href={`/prontuarios/${id}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Editar prontuário – {record.patient.name}</h1>
      <p className="text-sm text-gray-500 mb-6">Nº {record.serialNumber.slice(0, 12)} · as alterações ficam registradas no histórico de auditoria</p>
      <EditRecordForm
        stock={stock}
        initial={{
          id: record.id,
          lotsEditable,
          patientSpecies: record.patient.species,
          pathology: record.pathology,
          cellQuantity: record.cellQuantity || "",
          applicationRoute: record.applicationRoute || "",
          donors: record.donors || "",
          serumCollected: record.serumCollected,
          applications: record.applications.map((a) => ({
            id: a.id,
            number: a.number,
            date: day(a.date),
            items: a.items.map((it) => ({ batchId: it.batchId, category: it.category as "CELULAS" | "SORO" | "MEIO", quantity: String(it.quantity) })),
            summary: [a.cells && `Células: ${a.cells}`, a.serum && `Soro: ${a.serum}`, a.medium && `Meio: ${a.medium}`].filter(Boolean).join(" · "),
          })),
          thawings: record.thawings.map((t) => ({
            number: t.number,
            thawedStraws: t.thawedStraws?.toString() || "",
            thawedMeio: t.thawedMeio?.toString() || "",
            thawedSoro: t.thawedSoro?.toString() || "",
            retrievalLocation: t.retrievalLocation || "",
          })),
        }}
      />
    </div>
  );
}
