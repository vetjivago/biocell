"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";

export default function ReverseButton({ transactionId, label }: { transactionId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleReverse() {
    if (!confirm(`Estornar este lançamento?\n\n${label}\n\nO saldo é retirado do estoque e o histórico fica registrado.`)) return;
    setBusy(true);
    const res = await fetch(`/api/inventory/${transactionId}/reverse`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return alert(data.error || "Erro ao estornar");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleReverse} disabled={busy}
      className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50">
      <Undo2 size={12} /> {busy ? "Estornando..." : "Estornar"}
    </button>
  );
}
