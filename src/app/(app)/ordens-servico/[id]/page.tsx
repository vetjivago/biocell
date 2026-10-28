import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { APP_STATUS, ORDER_STATUS, canDeleteOrder, canFillOrderRecord, canSendToLab, getAccessibleOrder, orderStatus, parseChecklist } from "@/lib/service-orders";
import PrintButton from "../../pacientes/[id]/geral/PrintButton";
import { AddApplication, ApplicationActions, Checklist, DeleteOrderButton } from "./OrderActions";

const tz = { timeZone: "America/Sao_Paulo" } as const;
// Datas de aplicação são só dia (gravadas à meia-noite UTC)
const dayUTC = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "");
const dayInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

function Line({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-3 border-b border-gray-300 text-[15px] break-inside-avoid">
      <span className="font-bold text-gray-700 uppercase">{label}</span>: <span className="text-gray-900 whitespace-pre-line">{value || ""}</span>
    </div>
  );
}

export default async function OrdemPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const access = await getAccessibleOrder(session, id);
  if ("error" in access) notFound();

  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      patient: true,
      unit: true,
      createdBy: { select: { name: true } },
      applications: { orderBy: { number: "asc" } },
      attachments: { select: { id: true, fileName: true, checklistKey: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const st = ORDER_STATUS[orderStatus(order)];
  const p = order.patient;
  const requested = parseChecklist(order.checklist);
  const now = new Date().toLocaleString("pt-BR", { ...tz, dateStyle: "short", timeStyle: "short" });
  const nextNumber = (order.applications.at(-1)?.number || 0) + 1;
  // Sem nenhum prontuário preenchido a OS ainda pode ser apagada
  const canDelete = canDeleteOrder(session, order) && !order.applications.some((a) => a.status === "DONE" || a.medicalRecordId);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <Link href="/ordens-servico" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Ordens de serviço
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/pacientes/${p.id}?aba=ct`} className="text-sm text-primary hover:underline">Ver paciente</Link>
          {canDelete && <DeleteOrderButton orderId={order.id} serialNumber={order.serialNumber} />}
          <PrintButton />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 print:shadow-none print:border-0 print:p-0">
        {/* Cabeçalho (igual à OS impressa) */}
        <div className="flex items-start justify-between gap-4 border border-gray-200 rounded p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="BIO CELL by VETNIL" className="h-16 w-auto" />
          <div className="text-right text-xs text-gray-600">
            <p className="text-sm font-bold text-gray-800">BIO CELL</p>
            <p>{order.unit.name}</p>
            {order.unit.address && <p>{order.unit.address}</p>}
            <p>{order.unit.city}/{order.unit.state}{order.unit.phone ? ` · ${order.unit.phone}` : ""}</p>
          </div>
        </div>
        <p className="border border-gray-200 rounded p-2 mt-2 text-center text-sm font-semibold text-gray-800">Ordem de Serviço - Halógena</p>

        <div className="border border-gray-200 rounded p-3 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="font-semibold text-gray-700 inline-block w-28">Animal:</span>{p.name}</p>
          <p><span className="font-semibold text-gray-700 inline-block w-28">Peso:</span>{p.weight ? `${p.weight.toLocaleString("pt-BR")} kg` : "-"}</p>
          <p><span className="font-semibold text-gray-700 inline-block w-28">Espécie:</span>{p.species}</p>
          <p><span className="font-semibold text-gray-700 inline-block w-28">Raça:</span>{p.breed || "-"}</p>
          <p><span className="font-semibold text-gray-700 inline-block w-28">Responsável:</span>{p.ownerName}</p>
          <p><span className="font-semibold text-gray-700 inline-block w-28">Telefone:</span>{p.ownerPhone || "-"}</p>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <p>Por {order.createdBy.name} em {order.createdAt.toLocaleString("pt-BR", { ...tz, dateStyle: "short", timeStyle: "short" })}</p>
          <span className={`px-2 py-1 rounded text-xs font-medium print:hidden ${st.cls}`}>{st.label}</span>
        </div>

        <h1 className="text-2xl font-bold text-blue-700 text-center mt-6">ORDEM DE SERVIÇO - HALÓGENA</h1>
        <p className="text-lg font-bold text-blue-700 text-center">Nº DE SÉRIE: {order.serialNumber}</p>

        {order.applications.map((a, i) => {
          const as = APP_STATUS[a.status] || APP_STATUS.OPEN;
          return (
            <section key={a.id} className="mt-8">
              <div className="flex items-center justify-between gap-3 border-b border-gray-300 pb-2">
                <h2 className="text-xl font-bold text-blue-700">{a.number}ª APLICAÇÃO</h2>
                <span className={`px-2 py-1 rounded text-xs font-medium print:hidden ${as.cls}`}>{as.label}</span>
              </div>
              {(a.applicationRoute || a.cellQuantity || a.preparation) && (
                <div className="mt-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 break-inside-avoid">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-900 mb-2">Preparo das células</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[15px]">
                    <p><span className="font-bold text-gray-700">VIA DE APLICAÇÃO:</span> {a.applicationRoute || "–"}</p>
                    <p><span className="font-bold text-gray-700">QUANTIDADE DE CÉLULAS:</span> {a.cellQuantity || "–"}</p>
                    {a.preparation && (
                      <p className="sm:col-span-2 whitespace-pre-line"><span className="font-bold text-gray-700">FORMA DE PREPARO:</span> {a.preparation}</p>
                    )}
                  </div>
                </div>
              )}
              <Line label="Data" value={dayUTC(a.date)} />
              <Line label="Veterinário responsável" value={a.veterinarian} />
              {i === 0 && (
                <>
                  <Line label="Clínica" value={order.clinic} />
                  <Line label="Cidade" value={order.city} />
                  <Line label="Doença" value={order.disease} />
                  <Line label="Tempo de diagnóstico" value={order.diagnosisTime} />
                </>
              )}
              <Line label="Financeiro" value={a.financial} />
              <Line label="Observações técnicas" value={a.technicalNotes} />
              {i === 0 && (
                <div className="py-3 border-b border-gray-300 break-inside-avoid">
                  <p className="font-bold text-gray-700 uppercase text-[15px] mb-2">Check list:</p>
                  <Checklist orderId={order.id} requested={requested} attachments={order.attachments} />
                </div>
              )}
              {!order.cancelled && (
                <ApplicationActions
                  patientId={p.id}
                  canSend={canSendToLab(session.role)}
                  canFill={canFillOrderRecord(session.role)}
                  isFirst={i === 0}
                  app={{
                    id: a.id, number: a.number, status: a.status, date: dayInput(a.date), veterinarian: a.veterinarian || "",
                    financial: a.financial || "", technicalNotes: a.technicalNotes || "", medicalRecordId: a.medicalRecordId,
                    applicationRoute: a.applicationRoute || "", cellQuantity: a.cellQuantity || "", preparation: a.preparation || "",
                    sentToLab: a.sentToLabAt ? a.sentToLabAt.toLocaleString("pt-BR", { ...tz, dateStyle: "short", timeStyle: "short" }) : null,
                  }}
                  header={i === 0 ? { orderId: order.id, clinic: order.clinic || "", city: order.city || "", disease: order.disease || "", diagnosisTime: order.diagnosisTime || "" } : undefined}
                />
              )}
            </section>
          );
        })}

        <div className="mt-8 hidden print:flex justify-between text-xs text-gray-500">
          <span>Impresso em: {now}</span>
          <span>Por: {session.name}</span>
        </div>
      </div>

      {!order.cancelled && nextNumber <= 6 && (
        <div className="mt-4">
          <AddApplication
            orderId={order.id}
            nextNumber={nextNumber}
            defaultVet={order.applications.at(-1)?.veterinarian || ""}
            defaultPrep={{
              applicationRoute: order.applications.at(-1)?.applicationRoute || "",
              cellQuantity: order.applications.at(-1)?.cellQuantity || "",
              preparation: order.applications.at(-1)?.preparation || "",
            }}
          />
        </div>
      )}
    </div>
  );
}
