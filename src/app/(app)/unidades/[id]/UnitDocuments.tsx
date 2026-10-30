"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Lock, Paperclip, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { MAX_ATTACHMENT_BYTES } from "@/lib/clinical-types";
import { DOCUMENT_VISIBILITY, type DocumentVisibility } from "@/lib/units";

export interface UnitDocumentRow {
  id: string;
  kind: string;
  name: string;
  notes: string | null;
  dueDate: string | null; // AAAA-MM-DD
  visibility: string;
  updatedAt: string | null; // ISO; null se nunca foi mexido
  attachments: { id: string; fileName: string; size: number; createdAt: string }[];
}

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmtDate = (d: string) => d.split("-").reverse().join("/");
const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// Vencido em vermelho, vence em até 30 dias em amarelo
function dueClass(d: string | null) {
  if (!d) return "text-gray-400";
  const days = (new Date(`${d}T12:00:00`).getTime() - Date.now()) / 86400000;
  return days < 0 ? "text-red-600 font-semibold" : days <= 30 ? "text-amber-600 font-semibold" : "text-gray-700";
}

export default function UnitDocuments({ unitId, documents, canEdit }: { unitId: string; documents: UnitDocumentRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; name: string; notes: string; dueDate: string; visibility: DocumentVisibility } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError("");
    const res = await fetch(url, init).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setError(data?.error || "Erro ao salvar");
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, ...body } = editing;
    const ok = await call(id ? `/api/units/${unitId}/documents/${id}` : `/api/units/${unitId}/documents`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (ok) setEditing(null);
  }

  async function upload(docId: string, files: FileList | null) {
    for (const original of Array.from(files ?? [])) {
      const file = original.type.startsWith("image/") ? await compressImage(original) : original;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${original.name}: arquivo muito grande (máx. ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB)`);
        continue;
      }
      const body = new FormData();
      body.append("file", file, original.name);
      if (!(await call(`/api/units/${unitId}/documents/${docId}/attachments`, { method: "POST", body }))) break;
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const editForm = (
    <form onSubmit={saveEdit} className="grid grid-cols-1 sm:grid-cols-6 gap-3 bg-gray-50 rounded-lg p-3">
      {(editing?.id === null || documents.find((d) => d.id === editing?.id)?.kind === "OTHER") && (
        <div className="sm:col-span-6">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome do documento *</label>
          <input required value={editing?.name ?? ""} onChange={(e) => setEditing((s) => s && { ...s, name: e.target.value })} placeholder="Ex.: Alvará de funcionamento" className={input} />
        </div>
      )}
      <div className="sm:col-span-6">
        <label className="block text-xs font-medium text-gray-600 mb-1">Anotação</label>
        <textarea rows={2} value={editing?.notes ?? ""} onChange={(e) => setEditing((s) => s && { ...s, notes: e.target.value })} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Próximo vencimento</label>
        <input type="date" value={editing?.dueDate ?? ""} onChange={(e) => setEditing((s) => s && { ...s, dueDate: e.target.value })} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Permissão</label>
        <select value={editing?.visibility} onChange={(e) => setEditing((s) => s && { ...s, visibility: e.target.value as DocumentVisibility })} className={input}>
          {Object.entries(DOCUMENT_VISIBILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2 flex items-end gap-2">
        <button type="submit" disabled={busy} className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50">Salvar</button>
        <button type="button" onClick={() => setEditing(null)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
      </div>
      <p className="sm:col-span-6 text-xs text-gray-500">Público: todos que abrem a ficha da unidade (matriz, administrativo e comercial). Restrito: só matriz e administrativo.</p>
    </form>
  );

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><FileText size={18} className="text-gray-400" /> Documentos</h2>
        {canEdit && !editing && (
          <button type="button" onClick={() => setEditing({ id: null, name: "", notes: "", dueDate: "", visibility: "PUBLIC" })}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <Plus size={14} /> Novo documento
          </button>
        )}
      </div>
      {editing?.id === null && editForm}
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-3 font-semibold">Nome do documento</th>
              <th className="py-2 pr-3 font-semibold">Anotação</th>
              <th className="py-2 pr-3 font-semibold">Última modificação</th>
              <th className="py-2 pr-3 font-semibold">Próx. vencimento</th>
              <th className="py-2 pr-3 font-semibold">Anexos</th>
              <th className="py-2 pr-3 font-semibold">Permissão</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-gray-400">Nenhum documento cadastrado.</td></tr>
            )}
            {documents.map((d) => (
              <Fragment key={d.id}>
                <tr className="border-b border-gray-50 align-top">
                  <td className="py-2.5 pr-3 font-medium text-gray-900">{d.name}</td>
                  <td className="py-2.5 pr-3 text-gray-600 max-w-56"><span className="line-clamp-2 whitespace-pre-line">{d.notes || <span className="text-gray-400">Sem anotação</span>}</span></td>
                  <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">{d.updatedAt ? fmtDateTime(d.updatedAt) : "—"}</td>
                  <td className={`py-2.5 pr-3 whitespace-nowrap ${dueClass(d.dueDate)}`}>{d.dueDate ? fmtDate(d.dueDate) : "—"}</td>
                  <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap"><Paperclip size={13} className="inline mr-1" />{d.attachments.length} anexo{d.attachments.length === 1 ? "" : "s"}</td>
                  <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">
                    {d.visibility === "RESTRICTED" ? <Lock size={13} className="inline mr-1" /> : <Users size={13} className="inline mr-1" />}
                    {DOCUMENT_VISIBILITY[d.visibility as DocumentVisibility] ?? d.visibility}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => setOpen(open === d.id ? null : d.id)} className="px-3 py-1 bg-primary text-white rounded-md text-xs">Anexos</button>
                    {canEdit && (
                      <button type="button" aria-label="Editar documento" title="Editar anotação, vencimento e permissão"
                        onClick={() => setEditing({ id: d.id, name: d.name, notes: d.notes ?? "", dueDate: d.dueDate ?? "", visibility: (d.visibility as DocumentVisibility) || "PUBLIC" })}
                        className="ml-1 p-1.5 text-gray-400 hover:text-gray-700"><Pencil size={14} /></button>
                    )}
                  </td>
                </tr>
                {editing?.id === d.id && <tr><td colSpan={7} className="py-2">{editForm}</td></tr>}
                {open === d.id && (
                  <tr>
                    <td colSpan={7} className="py-2">
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        {d.attachments.length === 0 && <p className="text-xs text-gray-400">Nenhum anexo.</p>}
                        {d.attachments.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            <Paperclip size={14} className="text-gray-400 shrink-0" />
                            <a href={`/api/units/${unitId}/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{a.fileName}</a>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{fmtSize(a.size)} · {fmtDateTime(a.createdAt)}</span>
                            {canEdit && (
                              <button type="button" disabled={busy} aria-label="Apagar anexo"
                                onClick={() => confirm(`Apagar o anexo "${a.fileName}"?`) && call(`/api/units/${unitId}/attachments/${a.id}`, { method: "DELETE" })}
                                className="ml-auto p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                            )}
                          </div>
                        ))}
                        {canEdit && (
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <label className={`flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
                              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Anexar arquivos
                              <input ref={fileRef} type="file" multiple accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => upload(d.id, e.target.files)} />
                            </label>
                            <span className="text-xs text-gray-400">PDF, imagem, Word ou Excel, até {MAX_ATTACHMENT_BYTES / 1024 / 1024} MB cada</span>
                            {d.kind === "OTHER" && (
                              <button type="button" disabled={busy}
                                onClick={() => confirm(`Apagar o documento "${d.name}" e os ${d.attachments.length} anexo(s)?`) && call(`/api/units/${unitId}/documents/${d.id}`, { method: "DELETE" })}
                                className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 size={12} /> Apagar documento</button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
