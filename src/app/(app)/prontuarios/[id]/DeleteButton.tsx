"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteButton({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");

    const res = await fetch(`/api/medical-records/${recordId}`, { method: "DELETE" });

    if (res.ok) {
      router.push("/prontuarios");
    } else {
      const data = await res.json();
      setError(data.error || "Erro ao excluir");
      setConfirming(false);
    }
    setDeleting(false);
  }

  if (confirming) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700 mb-3">Tem certeza que deseja excluir este prontuário? Esta ação não pode ser desfeita.</p>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? "Excluindo..." : "Sim, excluir"}
          </button>
          <button onClick={() => setConfirming(false)}
            className="px-4 py-2 bg-white text-gray-700 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
      <Trash2 size={16} />
      Excluir
    </button>
  );
}
