"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, EyeOff, Eye, Trash2, ShieldAlert, X, Settings2 } from "lucide-react";

type Unit = { id: string; name: string; state: string };
type Counts = { records: number; orders: number; sales: number; entries: number; straws: number };

type Props = {
  patientId: string;
  patientName: string;
  archived: boolean;
  unitId: string;
  units: Unit[];
  counts: Counts;
};

// Ações só da matriz (perfil ADMIN): mover de UABC, ocultar/restaurar, excluir cadastro vazio e apagar tudo
export default function PatientAdminMenu({ patientId, patientName, archived, unitId, units, counts }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState("");
  const [confirmName, setConfirmName] = useState("");

  const hasHistory = counts.records + counts.orders + counts.sales + counts.entries > 0;
  const nameMatches = confirmName.trim().toLocaleLowerCase("pt-BR") === patientName.trim().toLocaleLowerCase("pt-BR");

  const history = [
    counts.records && `${counts.records} prontuário${counts.records > 1 ? "s" : ""}`,
    counts.orders && `${counts.orders} OS`,
    counts.sales && `${counts.sales} orçamento${counts.sales > 1 ? "s" : ""}/venda${counts.sales > 1 ? "s" : ""}`,
    counts.entries && `${counts.entries} registro${counts.entries > 1 ? "s" : ""} clínico${counts.entries > 1 ? "s" : ""}`,
  ].filter(Boolean).join(", ");

  async function call(url: string, body: object, after: "refresh" | "list") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível concluir");
        return;
      }
      setOpen(false);
      if (after === "list") router.push("/pacientes");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError("");
    setConfirmName("");
    setTarget("");
  };

  const section = "rounded-lg border border-gray-200 p-4";
  const btn = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50"
      >
        <Settings2 size={14} /> Matriz
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-admin-title"
            className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="patient-admin-title" className="text-lg font-semibold text-gray-900">Ações da matriz</h2>
                <p className="text-sm text-gray-500">{patientName}{history ? ` · ${history}` : " · sem histórico"}</p>
              </div>
              <button type="button" onClick={close} aria-label="Fechar" className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {error && <p className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</p>}

            {/* Mover */}
            <div className={section}>
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><ArrowRightLeft size={15} /> Mover para outra UABC</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Os próximos atendimentos passam a ser da nova unidade, e a equipe dela vê a ficha completa. O histórico já registrado continua na unidade onde aconteceu.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-label="Unidade de destino"
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Selecione a unidade…</option>
                  {units.filter((u) => u.id !== unitId).map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.state === "EXT" ? "Internacional" : u.state})</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!target || busy}
                  onClick={() => call(`/api/patients/${patientId}/move`, { unitId: target }, "refresh")}
                  className={`${btn} justify-center bg-primary hover:bg-primary-light text-white`}
                >
                  Mover
                </button>
              </div>
            </div>

            {/* Ocultar / restaurar */}
            <div className={section}>
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                {archived ? <Eye size={15} /> : <EyeOff size={15} />} {archived ? "Restaurar paciente" : "Ocultar paciente"}
              </p>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                {archived
                  ? "Volta a aparecer nas listas, buscas e totais."
                  : "Some das listas, buscas e totais, mas prontuários e baixas de estoque continuam guardados. Dá para restaurar em Pacientes → Ver ocultos."}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => call(`/api/patients/${patientId}/remove`, { mode: archived ? "restore" : "archive" }, archived ? "refresh" : "list")}
                className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
              >
                {archived ? "Restaurar" : "Ocultar"}
              </button>
            </div>

            {/* Excluir cadastro vazio */}
            <div className={section}>
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><Trash2 size={15} /> Excluir cadastro</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                {hasHistory
                  ? "Indisponível: o paciente já tem histórico. Use Ocultar ou Apagar tudo."
                  : "Apaga de vez um cadastro sem nenhum histórico (ex.: duplicado ou criado por engano)."}
              </p>
              <button
                type="button"
                disabled={busy || hasHistory}
                onClick={() => call(`/api/patients/${patientId}/remove`, { mode: "empty" }, "list")}
                className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`}
              >
                Excluir cadastro
              </button>
            </div>

            {/* Apagar tudo */}
            <div className={`${section} border-red-200 bg-red-50/40`}>
              <p className="text-sm font-medium text-red-700 flex items-center gap-1.5"><ShieldAlert size={15} /> Apagar paciente e todo o histórico</p>
              <p className="text-xs text-gray-600 mt-1 mb-3">
                Remove o paciente{history ? `, ${history}` : ""}. Não tem volta.
                {counts.straws > 0 && ` As ${counts.straws} palheta${counts.straws > 1 ? "s" : ""} baixada${counts.straws > 1 ? "s" : ""} nos prontuários voltam ao saldo da unidade (lançamento de estorno no estoque).`}
              </p>
              <label className="block text-xs text-gray-600 mb-1" htmlFor="confirm-name">Para confirmar, digite o nome do paciente: <strong>{patientName}</strong></label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="confirm-name"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  autoComplete="off"
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
                <button
                  type="button"
                  disabled={busy || !nameMatches}
                  onClick={() => call(`/api/patients/${patientId}/remove`, { mode: "all" }, "list")}
                  className={`${btn} justify-center bg-red-600 hover:bg-red-700 text-white`}
                >
                  Apagar tudo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
