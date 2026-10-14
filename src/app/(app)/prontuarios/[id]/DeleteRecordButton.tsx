"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteRecordButton({ recordId, fromServiceOrder }: { recordId: string; fromServiceOrder: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const msg = `Excluir este prontuário? Esta ação não pode ser desfeita.${fromServiceOrder ? "\n\nA aplicação da Ordem de Serviço volta para “Em preparo”." : ""}`;
    if (!confirm(msg)) return;
    setBusy(true);
    const res = await fetch(`/api/medical-records/${recordId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Erro ao excluir");
      setBusy(false);
      return;
    }
    router.push(data.patientId ? `/pacientes/${data.patientId}?aba=ct` : "/prontuarios");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleDelete} disabled={busy}
      className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
      <Trash2 size={14} /> {busy ? "Excluindo..." : "Excluir"}
    </button>
  );
}
