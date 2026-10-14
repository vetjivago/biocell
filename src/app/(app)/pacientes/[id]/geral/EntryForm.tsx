"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X, FileText } from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { PATHOLOGIES } from "@/lib/pathologies";
import {
  ATTENDANCE_SUBTYPES, ENTRY_TEMPLATES, ENTRY_TYPES, MAX_ATTACHMENT_BYTES, TITLE_LABEL, type EntryType,
} from "@/lib/clinical-types";

interface Initial {
  id?: string;
  type: EntryType;
  title: string;
  content: string;
  weight: string;
  subtype: string;
  returnDate: string; // AAAA-MM-DD
  endedAt: string | null; // ISO
  videoUrl: string;
  occurredAt: string | null; // ISO; null = agora
  attachments?: { id: string; fileName: string; size: number }[];
}

type Draft = Pick<Initial, "title" | "content" | "weight" | "subtype" | "returnDate" | "videoUrl"> & { savedAt: number };

const AUTOSAVE_MS = 20_000;
const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-sm font-medium text-gray-700 mb-1";

// Data/hora local no formato do input datetime-local
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export default function EntryForm({ patientId, initial }: { patientId: string; initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  // Depois de criado (ex.: anexo falhou), novas tentativas atualizam o mesmo registro
  const [entryId, setEntryId] = useState<string | undefined>(initial.id);
  const isEdit = !!initial.id;

  // Datas padrão usam o relógio/fuso do aparelho; só calculadas no navegador (evita divergência com o servidor)
  const isClient = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [baseDate] = useState(() => (initial.occurredAt ? new Date(initial.occurredAt) : new Date()));
  const [localDate, setLocalDate] = useState<string | null>(null);
  const occurredInput = localDate ?? (isClient ? toLocalInput(baseDate) : "");
  const [localEnded, setLocalEnded] = useState<string | null>(null);
  const endedInput = localEnded ?? (isClient && initial.endedAt ? toLocalInput(new Date(initial.endedAt)) : "");

  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Rascunho salvo no aparelho a cada 20s (não perde o texto se a página fechar ou a internet cair)
  const draftKey = `biocell.rascunho.${patientId}.${initial.id ?? `novo.${initial.type}`}`;
  const storedDraft = useSyncExternalStore(
    () => () => {},
    () => (typeof localStorage === "undefined" ? null : localStorage.getItem(draftKey)),
    () => null
  );
  const [draftHandled, setDraftHandled] = useState(false);
  const draft = !draftHandled && storedDraft ? readDraft(draftKey) : null;
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const dirty = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!dirty.current) return;
      const f = formRef.current;
      const d: Draft = { title: f.title, content: f.content, weight: f.weight, subtype: f.subtype, returnDate: f.returnDate, videoUrl: f.videoUrl, savedAt: Date.now() };
      try {
        localStorage.setItem(draftKey, JSON.stringify(d));
        dirty.current = false;
        setLastSaved(d.savedAt);
      } catch { /* armazenamento indisponível */ }
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [draftKey]);

  const type = form.type;
  const template = ENTRY_TEMPLATES[type];
  const titleLabel = TITLE_LABEL[type] || "Resumo";

  function update<K extends keyof Initial>(field: K, value: Initial[K]) {
    dirty.current = true;
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const prepared: File[] = [];
    for (const f of Array.from(list)) {
      const c = await compressImage(f);
      if (c.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${f.name}" passa de ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB. ${f.type.startsWith("video/") ? "Para vídeos maiores use o link (YouTube, Google Drive...)." : "Reduza o arquivo ou divida o PDF."}`);
        continue;
      }
      prepared.push(c);
    }
    setFiles((prev) => [...prev, ...prepared]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      type,
      title: form.title,
      content: form.content,
      weight: type === "PESO" ? form.weight : null,
      subtype: form.subtype,
      returnDate: form.returnDate || null,
      endedAt: type === "INTERNACAO" && endedInput ? new Date(endedInput).toISOString() : null,
      videoUrl: form.videoUrl,
      occurredAt: new Date(localDate ?? toLocalInput(baseDate)).toISOString(),
    };

    const res = await fetch(entryId ? `/api/clinical-entries/${entryId}` : `/api/patients/${patientId}/clinical`, {
      method: entryId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Erro ao salvar registro");
      setSaving(false);
      return;
    }
    const id: string = entryId ?? data.id;
    setEntryId(id);
    try { localStorage.removeItem(draftKey); } catch { /* ok */ }

    // Anexos: um por requisição; se algum falhar o registro já está salvo
    const failed: File[] = [];
    const messages: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress(`Enviando anexo ${i + 1} de ${files.length}...`);
      const body = new FormData();
      body.append("file", file);
      const up = await fetch(`/api/clinical-entries/${id}/attachments`, { method: "POST", body });
      if (!up.ok) {
        failed.push(file);
        messages.push(`${file.name}: ${(await up.json().catch(() => ({}))).error || "falha no envio"}`);
      }
    }
    if (failed.length > 0) {
      setError(`Registro salvo, mas alguns anexos falharam (tente salvar de novo):\n${messages.join("\n")}`);
      setFiles(failed);
      setSaving(false);
      setProgress("");
      return;
    }

    router.push(`/pacientes/${patientId}/geral/${id}`);
    router.refresh();
  }

  const fmtTime = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {draft && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm">
          <span>Há um rascunho não salvo de {new Date(draft.savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.</span>
          <span className="flex gap-3">
            <button type="button" className="font-semibold underline"
              onClick={() => {
                setForm((f) => ({ ...f, title: draft.title, content: draft.content, weight: draft.weight, subtype: draft.subtype, returnDate: draft.returnDate, videoUrl: draft.videoUrl }));
                setDraftHandled(true);
              }}>
              Recuperar
            </button>
            <button type="button" className="text-amber-700"
              onClick={() => {
                try { localStorage.removeItem(draftKey); } catch { /* ok */ }
                setDraftHandled(true);
              }}>
              Descartar
            </button>
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Tipo</label>
            <select value={type} onChange={(e) => update("type", e.target.value as EntryType)} disabled={isEdit}
              className={`${input} disabled:bg-gray-50 disabled:text-gray-600`}>
              {Object.entries(ENTRY_TYPES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{type === "INTERNACAO" ? "Entrada" : "Data e hora"}</label>
            <input type="datetime-local" required value={occurredInput} onChange={(e) => setLocalDate(e.target.value)} className={input} />
          </div>

          {type === "ATENDIMENTO" && (
            <div>
              <label className={label}>Tipo do atendimento</label>
              <input list="attendance-subtypes" value={form.subtype} onChange={(e) => update("subtype", e.target.value)} className={input}
                placeholder="Ex: Aplicação CT, Retorno, C15..." />
              <datalist id="attendance-subtypes">{ATTENDANCE_SUBTYPES.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
          )}
          {type === "INTERNACAO" && (
            <div>
              <label className={label}>Alta</label>
              <input type="datetime-local" value={endedInput} onChange={(e) => setLocalEnded(e.target.value)} className={input} />
              <p className="text-xs text-gray-400 mt-1">Deixe em branco enquanto o animal estiver internado.</p>
            </div>
          )}
          {type === "PESO" && (
            <div>
              <label className={label}>Peso (kg) *</label>
              <input required inputMode="decimal" value={form.weight} onChange={(e) => update("weight", e.target.value)} className={input} placeholder="Ex: 5,8" />
            </div>
          )}

          <div className={type === "ATENDIMENTO" || type === "INTERNACAO" || type === "PESO" ? "" : "sm:col-span-2"}>
            <label className={label}>{titleLabel}</label>
            <input value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={200} className={input}
              required={type === "PATOLOGIA"}
              list={type === "PATOLOGIA" ? "pathologies" : undefined}
              placeholder={type === "PESO" ? "Ex: Informado pela clínica" : type === "PATOLOGIA" ? "Ex: Doença Renal Crônica" : "Ex: 3ª aplicação, Hemograma 18/09..."} />
            {type === "PATOLOGIA" && <datalist id="pathologies">{PATHOLOGIES.map((p) => <option key={p} value={p} />)}</datalist>}
          </div>

          {type === "VIDEO" && (
            <div className="sm:col-span-2">
              <label className={label}>Link do vídeo</label>
              <input type="url" value={form.videoUrl} onChange={(e) => update("videoUrl", e.target.value)} className={input}
                placeholder="https://youtube.com/... ou link do Google Drive" />
              <p className="text-xs text-gray-400 mt-1">Vídeos curtos (até 4 MB) também podem ser anexados abaixo.</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              {type === "PESO" || type === "PATOLOGIA" ? "Observações" : "Descrição"}
            </label>
            {template && !isEdit && (
              <button type="button" className="text-xs text-primary hover:underline"
                onClick={() => update("content", form.content.trim() ? `${form.content}\n\n${template}` : template)}>
                Inserir roteiro
              </button>
            )}
          </div>
          <textarea value={form.content} onChange={(e) => update("content", e.target.value)}
            rows={type === "PESO" || type === "PATOLOGIA" || type === "FOTOS" || type === "VIDEO" ? 3 : 14}
            className={`${input} leading-relaxed font-[inherit]`}
            placeholder={type === "ATENDIMENTO" ? "Anamnese, histórico, exame físico, achados, conduta..." : ""} />
          <p className="text-xs text-gray-400 mt-1">
            Rascunho salvo neste aparelho a cada 20 segundos{lastSaved ? ` · último às ${fmtTime(lastSaved)}` : ""}.
          </p>
        </div>

        {(type === "ATENDIMENTO" || type === "EXAME" || type === "INTERNACAO" || type === "VACINA") && (
          <div className="sm:w-1/2">
            <label className={label}>Agendar retorno</label>
            <input type="date" value={form.returnDate} onChange={(e) => update("returnDate", e.target.value)} className={input} />
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">{type === "FOTOS" ? "Fotos" : "Anexos"}</p>
          {initial.attachments && initial.attachments.length > 0 && (
            <ul className="mb-2 space-y-1">
              {initial.attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText size={14} /> {a.fileName} <span className="text-gray-400">({formatSize(a.size)})</span>
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && (
            <ul className="mb-2 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-gray-800">
                  <Paperclip size={14} /> {f.name} <span className="text-gray-400">({formatSize(f.size)})</span>
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500" aria-label={`Remover ${f.name}`}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input ref={fileInput} type="file" multiple id="attachments" className="hidden" onChange={(e) => addFiles(e.target.files)}
            accept={type === "FOTOS" ? "image/*" : type === "VIDEO" ? "video/mp4,video/webm,video/quicktime" : "image/*,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.xls,.xlsx,.txt"} />
          <label htmlFor="attachments"
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
            <Paperclip size={14} /> {type === "FOTOS" ? "Adicionar fotos" : type === "VIDEO" ? "Anexar vídeo curto" : "Adicionar arquivos"}
          </label>
          <p className="text-xs text-gray-400 mt-1">PDF, imagens, vídeo curto, Word ou Excel · até 4 MB por arquivo (fotos são reduzidas automaticamente)</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">{error}</div>}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {saving ? progress || "Salvando..." : isEdit ? "Salvar alterações" : "Salvar registro"}
        </button>
      </div>
    </form>
  );
}
