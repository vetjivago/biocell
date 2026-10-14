"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X, FileText } from "lucide-react";
import { ENTRY_TEMPLATES, ENTRY_TYPES, MAX_ATTACHMENT_BYTES, type EntryType } from "@/lib/clinical-types";

interface Initial {
  id?: string;
  type: EntryType;
  title: string;
  content: string;
  weight: string;
  occurredAt: string | null; // ISO; null = agora
  attachments?: { id: string; fileName: string; size: number }[];
}

// Data/hora local no formato do input datetime-local
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Fotos de celular costumam passar de 4 MB: reduz para JPEG até 2000px antes de enviar
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // formato não suportado pelo navegador (ex.: HEIC): envia como está
  }
}

export default function EntryForm({ patientId, initial }: { patientId: string; initial: Initial }) {
  const router = useRouter();
  const isEdit = !!initial.id;
  const [form, setForm] = useState(initial);
  // A data padrão usa o relógio/fuso do aparelho; só é calculada no navegador (evita divergência com o servidor)
  const isClient = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [baseDate] = useState(() => (initial.occurredAt ? new Date(initial.occurredAt) : new Date()));
  const [localDate, setLocalDate] = useState<string | null>(null);
  const occurredInput = localDate ?? (isClient ? toLocalInput(baseDate) : "");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const template = ENTRY_TEMPLATES[form.type];
  const isWeight = form.type === "PESO";

  function update<K extends keyof Initial>(field: K, value: Initial[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const prepared: File[] = [];
    for (const f of Array.from(list)) {
      const c = await compressImage(f);
      if (c.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${f.name}" passa de ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB. Reduza o arquivo ou divida o PDF.`);
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
      type: form.type,
      title: form.title,
      content: form.content,
      weight: isWeight ? form.weight.replace(",", ".") : null,
      occurredAt: new Date(localDate ?? toLocalInput(baseDate)).toISOString(),
    };

    const res = await fetch(isEdit ? `/api/clinical-entries/${initial.id}` : `/api/patients/${patientId}/clinical`, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Erro ao salvar registro");
      setSaving(false);
      return;
    }

    const entryId = isEdit ? initial.id! : data.id;
    // Anexos: um por requisição; se algum falhar o registro já está salvo
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress(`Enviando anexo ${i + 1} de ${files.length}...`);
      const body = new FormData();
      body.append("file", file);
      const up = await fetch(`/api/clinical-entries/${entryId}/attachments`, { method: "POST", body });
      if (!up.ok) {
        const err = await up.json().catch(() => ({}));
        failed.push(`${file.name}: ${err.error || "falha no envio"}`);
      }
    }
    if (failed.length > 0) {
      setError(`Registro salvo, mas alguns anexos falharam:\n${failed.join("\n")}`);
      setFiles((prev) => prev.filter((f) => failed.some((m) => m.startsWith(f.name))));
      setSaving(false);
      setProgress("");
      return;
    }

    router.push(`/pacientes/${patientId}/geral/${entryId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value as EntryType)}
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600"
            >
              {Object.entries(ENTRY_TYPES).map(([key, t]) => (
                <option key={key} value={key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data e hora</label>
            <input
              type="datetime-local"
              required
              value={occurredInput}
              onChange={(e) => setLocalDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {isWeight ? (
          <div className="sm:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg) *</label>
            <input
              required
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => update("weight", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: 5,8"
            />
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resumo</label>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder={isWeight ? "Ex: Informado pela clínica" : "Ex: Consulta de retorno, 3ª aplicação, Hemograma 18/09..."}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">{isWeight ? "Observações" : "Descrição"}</label>
            {template && !isEdit && (
              <button
                type="button"
                onClick={() => update("content", form.content.trim() ? `${form.content}\n\n${template}` : template)}
                className="text-xs text-primary hover:underline"
              >
                Inserir roteiro
              </button>
            )}
          </div>
          <textarea
            value={form.content}
            onChange={(e) => update("content", e.target.value)}
            rows={isWeight ? 3 : 14}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm leading-relaxed font-[inherit]"
            placeholder={isWeight ? "" : "Anamnese, histórico, exame físico, achados, conduta..."}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Anexos</p>
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
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            id="attachments"
          />
          <label htmlFor="attachments"
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
            <Paperclip size={14} /> Adicionar arquivos
          </label>
          <p className="text-xs text-gray-400 mt-1">PDF, imagens, Word ou Excel · até 4 MB por arquivo (fotos são reduzidas automaticamente)</p>
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
