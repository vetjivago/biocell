"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, Loader2, Trash2 } from "lucide-react";
import { compressImage } from "@/lib/compress-image";

interface Photo { id: string; fileName: string; mimeType: string }

// Fotos das palhetas: obrigatórias para concluir o atendimento
export default function RecordPhotos({ recordId, photos, canChange, uploadFailed = false }: {
  recordId: string;
  photos: Photo[];
  canChange: boolean;
  uploadFailed?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(uploadFailed ? "Alguma foto não foi enviada ao salvar o prontuário. Anexe novamente." : "");

  async function upload(files: File[]) {
    setBusy(true);
    setError("");
    for (const f of files) {
      const body = new FormData();
      body.append("file", await compressImage(f));
      const res = await fetch(`/api/medical-records/${recordId}/attachments`, { method: "POST", body }).catch(() => null);
      if (!res?.ok) {
        const data = await res?.json().catch(() => ({}));
        setError(data?.error || `Não foi possível enviar ${f.name}`);
      }
    }
    setBusy(false);
    router.refresh();
  }

  async function remove(p: Photo) {
    if (!confirm(`Remover a foto ${p.fileName}?`)) return;
    const res = await fetch(`/api/medical-record-attachments/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error || "Erro ao remover");
    }
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-gray-900">Foto das palhetas</h2>
        {canChange && (
          <label className={`inline-flex items-center gap-2 px-3 py-1.5 border border-primary text-primary rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/5 print:hidden ${busy ? "opacity-50 pointer-events-none" : ""}`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Anexar foto
            <input type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ""; if (files.length) upload(files); }} />
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {photos.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Nenhuma foto anexada. A foto das palhetas é obrigatória para concluir o atendimento.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              <a href={`/api/medical-record-attachments/${p.id}`} target="_blank" rel="noopener"
                className="block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                {p.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/medical-record-attachments/${p.id}`} alt={p.fileName} className="w-full h-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center justify-center h-full gap-1 text-xs text-gray-500 p-2 text-center">
                    <FileText size={24} /> {p.fileName}
                  </span>
                )}
              </a>
              {canChange && (
                <button type="button" onClick={() => remove(p)} aria-label="Remover foto"
                  className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 rounded-md text-gray-500 hover:text-red-600 shadow-sm print:hidden">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
