import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CompleteButton from "./CompleteButton";

export default async function ProntuarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      patient: true,
      unit: true,
      professional: true,
      applications: { orderBy: { number: "asc" } },
      thawings: { orderBy: { number: "asc" } },
      procedures: { orderBy: { date: "desc" } },
      inventoryTransactions: {
        include: { batch: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  if (!record) notFound();

  const statusConfig: Record<string, { label: string; cls: string }> = {
    OPEN: { label: "Aberto", cls: "bg-blue-100 text-blue-800" },
    IN_PROGRESS: { label: "Em andamento", cls: "bg-yellow-100 text-yellow-800" },
    COMPLETED: { label: "Concluído", cls: "bg-green-100 text-green-800" },
    CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-800" },
  };
  const st = statusConfig[record.status] || statusConfig.OPEN;

  return (
    <div className="max-w-4xl">
      <Link href="/prontuarios" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prontuário de Células-Tronco</h1>
          <p className="text-sm text-gray-500 mt-1">Nº {record.serialNumber.slice(0, 12)} • {record.unit.name}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${st.cls}`}>{st.label}</span>
      </div>

      {/* Dados do Animal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Dados do Animal</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500">Nome</p><p className="font-medium">{record.patient.name}</p></div>
          <div><p className="text-gray-500">Espécie/Raça</p><p className="font-medium">{record.patient.species}{record.patient.breed ? ` – ${record.patient.breed}` : ""}</p></div>
          <div><p className="text-gray-500">Peso</p><p className="font-medium">{record.patient.weight ? `${record.patient.weight} kg` : "–"}</p></div>
          <div><p className="text-gray-500">Responsável</p><p className="font-medium">{record.patient.ownerName}</p></div>
          <div><p className="text-gray-500">Veterinário</p><p className="font-medium">{record.patient.veterinarian || "–"}</p></div>
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
              <div key={a.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="font-medium text-gray-700">{a.number}ª</span>
                <span className="text-gray-600">{a.date ? new Date(a.date).toLocaleDateString("pt-BR") : "–"}</span>
                <span className="text-gray-600">Células: {a.cells || "–"}</span>
                <span className="text-gray-600">Soro: {a.serum || "–"}</span>
                <span className="text-gray-600">Meio: {a.medium || "–"}</span>
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
              <div key={t.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="font-medium text-gray-700">{t.number}º</span>
                <span className="text-gray-600">Palhetas: {t.thawedStraws || "–"}</span>
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
                  <span className="font-medium text-red-600">{t.quantity} palhetas</span>
                  <span className="text-gray-500 ml-2">{t.batch.product.name}</span>
                  <span className="text-gray-400 ml-2">Lote: {t.batch.batchNumber}</span>
                </div>
                <span className="text-gray-500">Saldo: {t.balance}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão de Concluir */}
      {record.status === "OPEN" && (
        <CompleteButton recordId={record.id} unitId={record.unitId} />
      )}
    </div>
  );
}
