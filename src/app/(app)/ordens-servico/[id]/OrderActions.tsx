"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Paperclip, Pencil, FlaskConical, FilePlus, Trash2, Send, CheckCircle } from "lucide-react";
import { CHECKLIST_TERMS, ROUTE_OPTIONS, type ChecklistKey } from "@/lib/service-order-types";
import { MAX_ATTACHMENT_BYTES } from "@/lib/clinical-types";

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-xs font-medium text-gray-500 mb-1";

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro ao salvar");
  return data;
}

// Ações de uma aplicação: concluir OS (clínico avisa o laboratório), iniciar preparo, preencher prontuário, editar dados
export function ApplicationActions({
  app, patientId, isFirst, header, canSend, canFill,
}: {
  app: {
    id: string; number: number; status: string; date: string; veterinarian: string; financial: string; technicalNotes: string;
    applicationRoute: string; cellQuantity: string; preparation: string; medicalRecordId: string | null; sentToLab: string | null;
  };
  patientId: string;
  isFirst: boolean;
  header?: { orderId: string; clinic: string; city: string; disease: string; diagnosisTime: string };
  canSend: boolean;
  canFill: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...app, ...(header || {}) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={label}>Data</label><input type="date" value={form.date} onChange={set("date")} className={input} /></div>
          <div><label className={label}>Veterinário responsável</label><input value={form.veterinarian} onChange={set("veterinarian")} className={input} /></div>
          {isFirst && header && (
            <>
              <div><label className={label}>Clínica</label><input value={form.clinic} onChange={set("clinic")} className={input} /></div>
              <div><label className={label}>Cidade</label><input value={form.city} onChange={set("city")} className={input} /></div>
              <div><label className={label}>Doença</label><input value={form.disease} onChange={set("disease")} className={input} /></div>
              <div><label className={label}>Tempo de diagnóstico</label><input value={form.diagnosisTime} onChange={set("diagnosisTime")} className={input} /></div>
            </>
          )}
          <PrepInputs values={form} set={set} />
          <div className="sm:col-span-2"><label className={label}>Financeiro</label><input value={form.financial} onChange={set("financial")} className={input} /></div>
          <div className="sm:col-span-2"><label className={label}>Observações técnicas</label><textarea value={form.technicalNotes} onChange={set("technicalNotes")} rows={3} className={input} /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
          <button type="button" disabled={busy}
            onClick={() => run(async () => {
              await send(`/api/service-order-applications/${app.id}`, "PATCH", {
                date: form.date || null, veterinarian: form.veterinarian, financial: form.financial, technicalNotes: form.technicalNotes,
                applicationRoute: form.applicationRoute, cellQuantity: form.cellQuantity, preparation: form.preparation,
              });
              if (isFirst && header) {
                await send(`/api/service-orders/${header.orderId}`, "PATCH", {
                  clinic: form.clinic, city: form.city, disease: form.disease, diagnosisTime: form.diagnosisTime,
                });
              }
            })}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
      {canSend && app.status === "OPEN" && !app.sentToLab && (
        <button type="button" disabled={busy}
          onClick={() => {
            if (!confirm("Concluir a OS e avisar o laboratório? Confira os dados e as orientações de preparo antes.")) return;
            run(() => send(`/api/service-order-applications/${app.id}`, "PATCH", { sendToLab: true }));
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-medium disabled:opacity-50">
          <Send size={14} /> {busy ? "Enviando..." : "Concluir OS"}
        </button>
      )}
      {app.sentToLab && app.status === "OPEN" && (
        <span className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle size={14} /> Concluída e enviada ao laboratório em {app.sentToLab}</span>
      )}
      {canFill && app.status === "OPEN" && (
        <button type="button" disabled={busy}
          onClick={() => run(() => send(`/api/service-order-applications/${app.id}`, "PATCH", { status: "IN_PREP" }))}
          className="flex items-center gap-1.5 px-3 py-2 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded-lg text-sm font-medium">
          <FlaskConical size={14} /> Iniciar preparo
        </button>
      )}
      {canFill && app.status !== "DONE" && (
        <Link href={`/prontuarios/novo?patientId=${patientId}&osApp=${app.id}`}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-medium">
          <FilePlus size={14} /> Preencher prontuário
        </Link>
      )}
      {app.medicalRecordId && (
        <Link href={`/prontuarios/${app.medicalRecordId}`} className="text-sm text-primary hover:underline">Ver prontuário →</Link>
      )}
      <button type="button" onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
        <Pencil size={14} /> Editar
      </button>
      {app.status === "IN_PREP" && (
        <button type="button" disabled={busy}
          onClick={() => run(() => send(`/api/service-order-applications/${app.id}`, "PATCH", { status: "OPEN" }))}
          className="text-xs text-gray-400 hover:text-gray-600">desfazer “em preparo”</button>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Campos de orientação ao preparo (via, quantidade, forma de preparo)
function PrepInputs({
  values, set,
}: {
  values: { applicationRoute: string; cellQuantity: string; preparation: string };
  set: (field: "applicationRoute" | "cellQuantity" | "preparation") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <p className="sm:col-span-2 text-xs font-semibold text-amber-900">Para quem prepara as células</p>
      <div>
        <label className={label}>Via de aplicação</label>
        <input list="os-routes-edit" value={values.applicationRoute} onChange={set("applicationRoute")} className={input} />
        <datalist id="os-routes-edit">{ROUTE_OPTIONS.map((r) => <option key={r} value={r} />)}</datalist>
      </div>
      <div><label className={label}>Quantidade de células</label><input value={values.cellQuantity} onChange={set("cellQuantity")} className={input} /></div>
      <div className="sm:col-span-2"><label className={label}>Forma de preparo</label><textarea value={values.preparation} onChange={set("preparation")} rows={3} className={input} /></div>
    </div>
  );
}

// Formulário da próxima aplicação (2ª, 3ª...)
export function AddApplication({
  orderId, nextNumber, defaultVet, defaultPrep,
}: {
  orderId: string; nextNumber: number; defaultVet: string;
  defaultPrep: { applicationRoute: string; cellQuantity: string; preparation: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", veterinarian: defaultVet, financial: "", technicalNotes: "", ...defaultPrep });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-primary hover:text-primary print:hidden">
        + Adicionar {nextNumber}ª aplicação
      </button>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3 print:hidden">
      <h3 className="font-semibold text-blue-700">{nextNumber}ª Aplicação</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={label}>Data</label><input type="date" value={form.date} onChange={set("date")} className={input} /></div>
        <div><label className={label}>Veterinário responsável</label><input value={form.veterinarian} onChange={set("veterinarian")} className={input} /></div>
        <PrepInputs values={form} set={set} />
          <div className="sm:col-span-2"><label className={label}>Financeiro</label><input value={form.financial} onChange={set("financial")} className={input} /></div>
        <div className="sm:col-span-2"><label className={label}>Observações técnicas</label><textarea value={form.technicalNotes} onChange={set("technicalNotes")} rows={3} className={input} /></div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
        <button type="button" disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await send(`/api/service-orders/${orderId}/applications`, "POST", { ...form, date: form.date || null });
              setOpen(false);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erro");
            } finally {
              setBusy(false);
            }
          }}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {busy ? "Salvando..." : "Adicionar aplicação"}
        </button>
      </div>
    </div>
  );
}

// Checklist dos termos: "solicitar" é marcado à mão; "anexar" quando o documento é enviado
export function Checklist({
  orderId, requested, attachments,
}: {
  orderId: string;
  requested: Partial<Record<ChecklistKey, boolean>>;
  attachments: { id: string; fileName: string; checklistKey: string | null }[];
}) {
  const router = useRouter();
  // Estado local para a tela responder na hora; o servidor confirma em seguida
  const [checked, setChecked] = useState(requested);
  const [files, setFiles] = useState(attachments);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function toggle(key: ChecklistKey, value: boolean) {
    setBusyKey(key);
    setError("");
    setChecked((c) => ({ ...c, [key]: value }));
    try {
      await send(`/api/service-orders/${orderId}`, "PATCH", { checklist: { [key]: value } });
      router.refresh();
    } catch (e) {
      setChecked((c) => ({ ...c, [key]: !value }));
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusyKey(null);
    }
  }

  async function upload(key: string, file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) return setError(`"${file.name}" passa de 4 MB`);
    setBusyKey(key);
    setError("");
    const body = new FormData();
    body.append("file", file);
    body.append("checklistKey", key);
    const res = await fetch(`/api/service-orders/${orderId}/attachments`, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Falha no envio");
    else setFiles((prev) => [...prev, { id: data.id, fileName: data.fileName, checklistKey: data.checklistKey }]);
    setBusyKey(null);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {CHECKLIST_TERMS.map((t) => {
        const termFiles = files.filter((a) => a.checklistKey === t.key);
        return (
          <div key={t.key} className="text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={!!checked[t.key]} disabled={busyKey === t.key}
                onChange={(e) => toggle(t.key, e.target.checked)} className="mt-0.5 rounded border-gray-300" />
              <span>Solicitar {t.label}.</span>
            </label>
            <div className="flex items-start gap-2 mt-1">
              <input type="checkbox" checked={termFiles.length > 0} readOnly className="mt-0.5 rounded border-gray-300" aria-label={`Anexado: ${t.label}`} />
              <span className="flex-1">
                Anexar {t.label}.
                {termFiles.map((f) => (
                  <a key={f.id} href={`/api/service-order-attachments/${f.id}`} target="_blank" rel="noopener"
                    className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                    <Paperclip size={12} />{f.fileName}
                  </a>
                ))}
                <input type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden"
                  ref={(el) => { fileInputs.current[t.key] = el; }}
                  onChange={(e) => upload(t.key, e.target.files?.[0])} />
                <button type="button" onClick={() => fileInputs.current[t.key]?.click()} disabled={busyKey === t.key}
                  className="ml-2 text-xs text-primary hover:underline print:hidden">
                  {busyKey === t.key ? "enviando..." : termFiles.length > 0 ? "+ outro arquivo" : "anexar arquivo"}
                </button>
              </span>
            </div>
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Apaga a OS enquanto nenhuma aplicação tem prontuário (aberta por engano, paciente desistiu...)
export function DeleteOrderButton({ orderId, serialNumber }: { orderId: string; serialNumber: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Apagar a OS ${serialNumber}? As aplicações e os anexos dela também são apagados. Não dá para desfazer.`)) return;
    setBusy(true);
    const res = await fetch(`/api/service-orders/${orderId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return alert(data.error || "Erro ao apagar");
    router.push("/ordens-servico");
    router.refresh();
  }

  return (
    <button type="button" onClick={remove} disabled={busy}
      className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
      <Trash2 size={14} /> {busy ? "Apagando..." : "Apagar OS"}
    </button>
  );
}
