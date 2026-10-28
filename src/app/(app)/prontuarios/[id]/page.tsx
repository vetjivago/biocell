import { prisma } from "@/lib/prisma";
import { CATEGORY_LABEL, NO_LOT } from "@/lib/products";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { canEditRecord } from "@/lib/record-applications";
import DeleteRecordButton from "./DeleteRecordButton";
import CompleteButton from "./CompleteButton";
import RecordPhotos from "./RecordPhotos";
import { hasRole } from "@/lib/roles";

export default async function ProntuarioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fotos?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const { fotos } = await searchParams;

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      patient: true,
      unit: true,
      professional: true,
      applications: {
        orderBy: { number: "asc" },
        include: { items: { include: { batch: { include: { product: { select: { name: true } } } } } } },
      },
      thawings: { orderBy: { number: "asc" } },
      attachments: { select: { id: true, fileName: true, mimeType: true }, orderBy: { createdAt: "asc" } },
      procedures: { orderBy: { date: "desc" } },
      serviceOrderApplication: { select: { number: true, veterinarian: true, serviceOrder: { select: { id: true, serialNumber: true } } } },
      inventoryTransactions: {
        include: { batch: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  if (!record) notFound();
  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(record.unitId)) notFound();
  const canEdit = canEditRecord(session, record);
  const deletable = record.status !== "COMPLETED" && record.inventoryTransactions.length === 0;

  const statusConfig: Record<string, { label: string; cls: string }> = {
    OPEN: { label: "Aberto", cls: "bg-blue-100 text-blue-800" },
    IN_PROGRESS: { label: "Em andamento", cls: "bg-yellow-100 text-yellow-800" },
    COMPLETED: { label: "Concluído", cls: "bg-green-100 text-green-800" },
    CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-800" },
  };
  const st = statusConfig[record.status] || statusConfig.OPEN;
  const categoryLabel = CATEGORY_LABEL;

  // Lotes escolhidos nas aplicações, somados por lote, para pré-preencher a baixa
  const plannedMap = new Map<string, { batchId: string; category: string; quantity: number }>();
  for (const it of record.applications.flatMap((a) => a.items)) {
    const prev = plannedMap.get(it.batchId);
    plannedMap.set(it.batchId, { batchId: it.batchId, category: it.category, quantity: (prev?.quantity || 0) + it.quantity });
  }
  const plannedItems = [...plannedMap.values()];

  return (
    <div className="max-w-4xl">
      <Link href="/prontuarios" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prontuário de Células-Tronco</h1>
          <p className="text-sm text-gray-500 mt-1">Nº {record.serialNumber} • {record.unit.name}</p>
          {record.serviceOrderApplication && (
            <p className="text-sm mt-1">
              <Link href={`/ordens-servico/${record.serviceOrderApplication.serviceOrder.id}`} className="text-primary hover:underline">
                OS nº {record.serviceOrderApplication.serviceOrder.serialNumber} – {record.serviceOrderApplication.number}ª aplicação
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <Link href={`/prontuarios/${record.id}/editar`}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <Pencil size={14} /> Editar
            </Link>
          )}
          {canEdit && deletable && <DeleteRecordButton recordId={record.id} fromServiceOrder={!!record.serviceOrderApplication} />}
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${st.cls}`}>{st.label}</span>
        </div>
      </div>

      {/* Dados do Animal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Dados do Animal</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500">Nome</p><p className="font-medium">{record.patient.name}</p></div>
          <div><p className="text-gray-500">Espécie/Raça</p><p className="font-medium">{record.patient.species}{record.patient.breed ? ` – ${record.patient.breed}` : ""}</p></div>
          <div><p className="text-gray-500">Peso</p><p className="font-medium">{record.patient.weight ? `${record.patient.weight} kg` : "–"}</p></div>
          <div><p className="text-gray-500">Responsável</p><p className="font-medium">{record.patient.ownerName}</p></div>
          <div><p className="text-gray-500">Veterinário afiliado</p><p className="font-medium">{record.serviceOrderApplication?.veterinarian || record.patient.veterinarian || "–"}</p></div>
          <div><p className="text-gray-500">Clínica</p><p className="font-medium">{record.patient.clinic || "–"}</p></div>
          <div><p className="text-gray-500">Soro Coletado</p><p className="font-medium">{record.serumCollected ? "Sim" : "Não"}</p></div>
          <div><p className="text-gray-500">Data</p><p className="font-medium">{new Date(record.requestDate).toLocaleDateString("pt-BR")}</p></div>
        </div>
      </div>

      {/* Protocolo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Protocolo de Tratamento</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="sm:col-span-2"><p className="text-gray-500">Patologia</p><p className="font-medium">{record.pathology}</p></div>
          <div><p className="text-gray-500">Qtd Células</p><p className="font-medium">{record.cellQuantity || "–"}</p></div>
          <div><p className="text-gray-500">Via de Aplicação</p><p className="font-medium">{record.applicationRoute || "–"}</p></div>
          <div><p className="text-gray-500">Doadores</p><p className="font-medium">{record.donors || "–"}</p></div>
          <div><p className="text-gray-500">Profissional</p><p className="font-medium">{record.professional.name}</p></div>
        </div>
      </div>

      {/* Aplicações */}
      {record.applications.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Aplicações</h2>
          <div className="space-y-2">
            {record.applications.map((a) => (
              <div key={a.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-medium text-gray-700">{a.number}ª</span>
                  <span className="text-gray-600">{a.date ? new Date(a.date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "–"}</span>
                  <span className="text-gray-600">Preparo: <span className="font-medium text-gray-800">{a.preparedBy || "–"}</span></span>
                  {a.items.length === 0 && (
                    <>
                      <span className="text-gray-600">Células: {a.cells || "–"}</span>
                      <span className="text-gray-600">Soro: {a.serum || "–"}</span>
                      <span className="text-gray-600">Meio: {a.medium || "–"}</span>
                    </>
                  )}
                </div>
                {a.items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {a.items.map((it) => (
                      <li key={it.id} className="flex flex-wrap gap-x-2 text-gray-600">
                        <span className="text-xs font-semibold uppercase text-gray-500 w-16">{categoryLabel[it.category] || it.category}</span>
                        <span className="font-medium text-gray-800">{it.quantity}</span>
                        <span>{it.batch.product.name}</span>
                        {it.batch.batchNumber !== NO_LOT && <span className="text-gray-400">Lote {it.batch.batchNumber}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Descongelamento */}
      {record.thawings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Descongelamento</h2>
          <div className="space-y-2">
            {record.thawings.map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm flex-wrap">
                <span className="font-medium text-gray-700">{t.number}º</span>
                <span className="text-gray-600">Palhetas: {t.thawedStraws || "–"}</span>
                <span className="text-gray-600">Meio: {t.thawedMeio || "–"}</span>
                <span className="text-gray-600">Soro: {t.thawedSoro || "–"}</span>
                <span className="text-gray-600">Local: {t.retrievalLocation || "–"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movimentações de Estoque */}
      {record.inventoryTransactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Movimentações de Estoque</h2>
          <div className="space-y-2">
            {record.inventoryTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-medium text-red-600">{t.quantity} un.</span>
                  <span className="text-gray-500 ml-2">{t.batch.product.name}</span>
                  {t.batch.batchNumber !== NO_LOT && <span className="text-gray-400 ml-2">Lote: {t.batch.batchNumber}</span>}
                </div>
                <span className="text-gray-500">Saldo: {t.balance}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RecordPhotos recordId={record.id} photos={record.attachments} canChange={canEdit || record.status === "OPEN"} uploadFailed={fotos === "erro"} />

      {/* Botão de Concluir */}
      {record.status === "OPEN" && (
        <CompleteButton
          recordId={record.id}
          unitId={record.unitId}
          cellQuantity={record.cellQuantity}
          meioQuantity={record.thawings.reduce((sum, t) => sum + (t.thawedMeio || 0), 0) || null}
          soroQuantity={record.thawings.reduce((sum, t) => sum + (t.thawedSoro || 0), 0) || null}
          plannedItems={plannedItems}
        />
      )}
    </div>
  );
}
