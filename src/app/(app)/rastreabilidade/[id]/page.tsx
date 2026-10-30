import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, PackageCheck, Syringe, Trash2, Package, Users, AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canSeeTracePatients, canTraceBatches, traceBatch } from "@/lib/batch-trace";
import { formatPhone, normalizePhone } from "@/lib/phone";
import PrintButton from "@/app/(app)/pacientes/[id]/geral/PrintButton";
import ExportButton from "./ExportButton";

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  RECEIPT: { label: "Recebimento", cls: "text-green-600" },
  CONSUMPTION: { label: "Uso em prontuário", cls: "text-red-600" },
  DISCARD: { label: "Descarte", cls: "text-orange-600" },
  ADJUSTMENT: { label: "Ajuste", cls: "text-blue-600" },
  TRANSFER_IN: { label: "Transferência (entrada)", cls: "text-green-600" },
  TRANSFER_OUT: { label: "Transferência (saída)", cls: "text-red-600" },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Aberto", cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "Em andamento", cls: "bg-yellow-100 text-yellow-700" },
  COMPLETED: { label: "Concluído", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-700" },
};

const day = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "–");

export default async function LoteTracePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!canTraceBatches(session.role)) notFound();

  const trace = await traceBatch((await params).id, session);
  if (!trace) notFound();
  const { batch, units, uses, timeline, totals } = trace;
  const showPatients = canSeeTracePatients(session.role);
  const unitLabel = batch.product.category === "CELULAS" ? "palhetas" : "un.";
  const expired = !!batch.expirationDate && batch.expirationDate < new Date();

  const csvRows = uses.map((r) => [
    r.patient.name, r.patient.species, r.patient.breed ?? "", r.patient.ownerName,
    formatPhone(normalizePhone(r.patient.ownerPhone)) || r.patient.ownerPhone || "", r.patient.ownerEmail ?? "",
    r.unit.name, `${r.unit.city}/${r.unit.state}`, r.serialNumber, r.pathology, STATUS[r.status]?.label ?? r.status,
    r.applications.map((a) => `${a.number}ª ${day(a.date)}`).join(", "), String(r.quantity), r.professional.name,
  ]);

  return (
    <div className="max-w-6xl">
      <Link href="/rastreabilidade" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4 print:hidden">
        <ArrowLeft size={16} /> Consultar outro lote
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Rastreabilidade do lote</p>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{batch.batchNumber}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {batch.product.name}
            {batch.manufacturingDate && <> · Fabricação {day(batch.manufacturingDate)}</>}
            {" · "}
            <span className={expired ? "text-red-600 font-medium" : ""}>Validade {day(batch.expirationDate)}{expired ? " (vencido)" : ""}</span>
            {" · "}Cadastrado em {day(batch.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          {showPatients && <ExportButton fileName={`recall-lote-${batch.batchNumber.replace(/[^\w.-]+/g, "_")}.csv`}
            header={["Paciente", "Espécie", "Raça", "Tutor", "Telefone", "E-mail", "Unidade", "Cidade/UF", "Prontuário", "Patologia", "Status", "Aplicações", "Quantidade", "Profissional"]}
            rows={csvRows} />}
          <PrintButton />
        </div>
      </div>

      {totals.patients > 0 && (
        <div className="flex items-start gap-2 p-3 mb-6 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>
            Em caso de recall: <b>{totals.unitsWithBalance}</b> {totals.unitsWithBalance === 1 ? "unidade ainda tem" : "unidades ainda têm"} saldo deste lote
            e <b>{totals.patients}</b> {totals.patients === 1 ? "paciente recebeu" : "pacientes receberam"} aplicações com ele
            {totals.openRecords > 0 && <> ({totals.openRecords} {totals.openRecords === 1 ? "prontuário ainda aberto" : "prontuários ainda abertos"})</>}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Recebido", value: totals.received, icon: PackageCheck, color: "#16a34a" },
          { label: "Usado em prontuários", value: totals.consumed, icon: Syringe, color: "#dc2626" },
          { label: "Descarte / ajustes", value: totals.otherOut, icon: Trash2, color: "#ea580c" },
          { label: "Saldo restante", value: totals.balance, icon: Package, color: "#005847" },
          { label: "Pacientes", value: totals.patients, icon: Users, color: "#7c3aed" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <c.icon size={22} style={{ color: c.color }} />
              <div>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Unidades que receberam ou usaram o lote */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Unidades ({totals.units})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Unidade</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">1º recebimento</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Recebido</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Usado</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Descarte / ajustes</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Saldo</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Pacientes</th>
              </tr>
            </thead>
            <tbody>
              {units.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma movimentação deste lote</td></tr>
              )}
              {units.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <Building2 size={15} className="text-primary shrink-0" />
                      <span className="font-medium text-gray-900">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.city}/{u.state}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{day(u.firstReceipt)}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-gray-600">{u.received}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-gray-600">{u.consumed}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-gray-600">{u.otherOut}</td>
                  <td className={`px-4 py-2.5 text-sm text-right font-bold ${u.balance > 0 ? "text-gray-900" : "text-gray-400"}`}>
                    {u.balance} <span className="text-xs font-normal text-gray-400">{unitLabel}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-gray-600">{u.patients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Prontuários / aplicações em que o lote foi usado */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pacientes e prontuários ({uses.length})</h2>
          <p className="text-xs text-gray-400 mt-0.5">Inclui prontuários ainda abertos em que o lote já foi informado na aplicação.</p>
        </div>
        {!showPatients ? (
          <p className="px-5 py-6 text-sm text-gray-500">
            {totals.patients} {totals.patients === 1 ? "paciente" : "pacientes"} em {uses.length} {uses.length === 1 ? "prontuário" : "prontuários"}.
            Os dados dos pacientes ficam visíveis para a Matriz e os gestores das unidades.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Paciente</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Tutor / contato</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Unidade</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Prontuário</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Aplicações</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Qtd</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {uses.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Lote ainda não usado em nenhum prontuário</td></tr>
                )}
                {uses.map((r) => {
                  const phone = normalizePhone(r.patient.ownerPhone);
                  const st = STATUS[r.status] ?? STATUS.OPEN;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0 align-top">
                      <td className="px-4 py-2.5 text-sm">
                        <Link href={`/pacientes/${r.patient.id}`} className="font-medium text-primary hover:underline">{r.patient.name}</Link>
                        <p className="text-xs text-gray-400">{r.patient.species}{r.patient.breed ? ` · ${r.patient.breed}` : ""}</p>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">
                        {r.patient.ownerName}
                        <p className="text-xs text-gray-400">
                          {phone
                            ? <a href={`https://wa.me/55${phone}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary">{formatPhone(phone)}</a>
                            : r.patient.ownerPhone}
                          {r.patient.ownerEmail && <> · <a href={`mailto:${r.patient.ownerEmail}`} className="hover:text-primary">{r.patient.ownerEmail}</a></>}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{r.unit.name}</td>
                      <td className="px-4 py-2.5 text-sm">
                        <Link href={`/prontuarios/${r.id}`} className="font-mono text-primary hover:underline">{r.serialNumber}</Link>
                        <p className="text-xs text-gray-400">{r.pathology} · {r.professional.name}</p>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">
                        {r.applications.length
                          ? r.applications.map((a) => `${a.number}ª (${day(a.date)})`).join(", ")
                          : `Baixa em ${day(r.completedAt)}`}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-900">{r.quantity}</td>
                      <td className="px-4 py-2.5 text-sm">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                        {r.status === "COMPLETED" && !r.consumed && <p className="text-xs text-gray-400 mt-0.5">sem baixa deste lote</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Linha do tempo das movimentações */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Movimentações do lote</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Data</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Tipo</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Unidade</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Detalhe</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Qtd</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Saldo na unidade</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((t) => {
                const tl = TYPE_LABELS[t.type] ?? { label: t.type, cls: "text-gray-600" };
                return (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 text-sm text-gray-500">{t.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</td>
                    <td className={`px-4 py-2.5 text-sm font-medium ${tl.cls}`}>{tl.label}{t.reversed && <span className="ml-1 text-xs font-normal text-gray-400">(estornado)</span>}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{t.unit.name}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">
                      {t.medicalRecord && showPatients
                        ? <Link href={`/prontuarios/${t.medicalRecord.id}`} className="text-primary hover:underline">{t.medicalRecord.patient.name} · {t.medicalRecord.serialNumber}</Link>
                        : t.reason || "–"}
                      {t.performedBy && <span className="text-xs text-gray-400"> · {t.performedBy}</span>}
                    </td>
                    <td className={`px-4 py-2.5 text-sm font-bold text-right ${t.quantity > 0 ? "text-green-600" : "text-red-600"}`}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-gray-600">{t.balance}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
