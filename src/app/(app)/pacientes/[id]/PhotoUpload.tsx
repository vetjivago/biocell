"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, PawPrint } from "lucide-react";
import { compressImage } from "@/lib/compress-image";

// Foto redonda do animal; clicar troca a foto (reduzida para 800px antes do envio)
export default function PhotoUpload({ patientId, hasPhoto, version }: { patientId: string; hasPhoto: boolean; version: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    const small = await compressImage(file, 800, 0);
    const body = new FormData();
    body.append("file", small);
    const res = await fetch(`/api/patients/${patientId}/photo`, { method: "POST", body });
    if (res.ok) {
      setLocalUrl(URL.createObjectURL(small));
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error || "Erro ao enviar foto");
    }
    setBusy(false);
  }

  const src = localUrl || (hasPhoto ? `/api/patients/${patientId}/photo?v=${version}` : null);
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 border border-gray-200 group print:pointer-events-none"
        aria-label={hasPhoto ? "Trocar foto do animal" : "Adicionar foto do animal"}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Foto do animal" className="w-full h-full object-cover" />
        ) : (
          <PawPrint className="w-10 h-10 text-gray-300 mx-auto" />
        )}
        <span className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
          <Camera size={20} />
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => upload(e.target.files?.[0])} />
      {busy && <span className="text-xs text-gray-400">Enviando...</span>}
      {error && <span className="text-xs text-red-600 max-w-[8rem] text-center">{error}</span>}
    </div>
  );
}
