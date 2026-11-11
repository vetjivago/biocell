"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, PackageX, X } from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { LOSS_CAUSES, MAX_LOSS_PHOTOS } from "@/lib/stock-loss";

const field = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary";

// Baixa por perda: palheta que estourou/quebrou. Tira do saldo do lote e guarda a foto (obrigatória)
export default function LossButton({ unitId, unitName, batchId, productName, batchLabel, balance, unitLabel }: {
  unitId: string;
  unitName: string;
  batchId: string;
  productName: string;
  batchLabel: string | null;
  balance: number;
  unitLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [cause, setCause] = useState<string>(LOSS_CAUSES[0]);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    photos.forEach((p) => URL.revokeObjectURL(p.url)); // libera as prévias
    setOpen(false);
    setQuantity("1");
    setCause(LOSS_CAUSES[0]);
    setNotes("");
    setPhotos([]);
    setError("");
  }

  function close() {
    if (!busy) reset();
  }

  async function addPhotos(files: File[]) {
    setError("");
    const room = MAX_LOSS_PHOTOS - photos.length;
    if (files.length > room) setError(`No máximo ${MAX_LOSS_PHOTOS} fotos`);
    // Reduz bem as fotos: todas seguem no mesmo envio da baixa
    const compressed = await Promise.all(files.slice(0, room).map((f) => compressImage(f, 1600, 300 * 1024)));
    setPhotos((ps) => [...ps, ...compressed.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const qty = parseInt(quantity, 10);
    if (!(qty > 0)) return setError("Informe a quantidade perdida");
    if (qty > balance) return setError(`O lote só tem ${balance} ${unitLabel} nesta unidade`);
    if (cause === "Outro" && !notes.trim()) return setError("Descreva o que aconteceu");
    if (photos.length === 0) return setError("Anexe a foto da palheta quebrada");

    const body = new FormData();
    body.append("unitId", unitId);
    body.append("batchId", batchId);
    body.append("quantity", String(qty));
    body.append("cause", cause);
    body.append("notes", notes);
    photos.forEach((p) => body.append("file", p.file));

    setBusy(true);
    const res = await fetch("/api/inventory/loss", { method: "POST", body }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}));
      return setError(data?.error || "Não foi possível registrar a baixa. Tente de novo.");
    }
    reset();
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-1 border border-orange-200 text-orange-700 rounded-lg text-xs hover:bg-orange-50">
        <PackageX size={12} /> Dar baixa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={close}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl shadow-xl p-5 max-h-[92vh] overflow-y-auto text-left whitespace-normal">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="font-semibold text-gray-900">Baixa por perda</h3>
              <button type="button" onClick={close} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-600">{productName}{batchLabel ? ` · lote ${batchLabel}` : ""}</p>
            <p className="text-xs text-gray-400 mb-4">{unitName} · saldo atual: {balance} {unitLabel}</p>

            <div className="grid grid-cols-[7rem_1fr] gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input type="number" min="1" max={balance} inputMode="numeric" required value={quantity}
                  onChange={(e) => setQuantity(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <select value={cause} onChange={(e) => setCause(e.target.value)} className={field}>
                  {LOSS_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">Observação {cause === "Outro" ? "" : "(opcional)"}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300}
              placeholder="Ex: estourou ao descongelar para a aplicação do paciente X" className={`${field} mb-3`} />

            <p className="text-sm font-medium text-gray-700 mb-1">Foto da palheta quebrada</p>
            <div className="flex flex-wrap gap-2 mb-1">
              {photos.map((p, i) => (
                <div key={p.url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button" aria-label="Remover foto" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((ps) => ps.filter((x) => x !== p)); }}
                    className="absolute top-1 right-1 p-0.5 bg-white/90 rounded text-gray-600 hover:text-red-600"><X size={13} /></button>
                </div>
              ))}
              {photos.length < MAX_LOSS_PHOTOS && (
                <label className="flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-lg border border-dashed border-primary text-primary text-xs cursor-pointer hover:bg-primary/5">
                  <Camera size={18} /> {photos.length ? "Mais uma" : "Anexar"}
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ""; if (files.length) addPhotos(files); }} />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">Obrigatória. No celular, dá para tirar a foto na hora. Até {MAX_LOSS_PHOTOS} fotos.</p>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} disabled={busy} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button type="submit" disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <PackageX size={15} />}
                {busy ? "Registrando..." : "Registrar baixa"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
