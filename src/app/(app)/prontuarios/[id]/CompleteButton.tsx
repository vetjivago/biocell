"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

interface StockItem {
  batchId: string;
  batchNumber: string;
  productName: string;
  balance: number;
}

function parseQuantity(cellQuantity: string | null): string {
  if (!cellQuantity) return "";
  const match = cellQuantity.match(/(\d+)/);
  return match ? match[1] : "";
}

export default function CompleteButton({
  recordId,
  unitId,
  cellQuantity,
}: {
  recordId: string;
  unitId: string;
  cellQuantity: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [batchId, setBatchId] = useState("");
  const [strawsUsed, setStrawsUsed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetch(`/api/inventory/stock?unitId=${unitId}`)
        .then((r) => r.json())
        .then((data: StockItem[]) => {
          setStock(data);
          if (data.length === 1) setBatchId(data[0].batchId);
          setStrawsUsed(parseQuantity(cellQuantity));
        });
    }
  }, [open, unitId, cellQuantity]);

  async function handleComplete() {
    if (!batchId || !strawsUsed) return;
    setLoading(true);
    setError("");

    const res = await fetch(`/api/medical-records/${recordId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, strawsUsed: parseInt(strawsUsed) }),
    });

    if (res.ok) {
      router.refresh();
      setOpen(false);
    } else {
      const data = await res.json();
      setError(data.error);
    }
    setLoading(false);
  }

  const selected = stock.find((s) => s.batchId === batchId);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-light text-white font-medium py-3 rounded-xl transition-colors text-lg"
      >
        <CheckCircle size={20} />
        Concluir Atendimento e Dar Baixa no Estoque
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-primary p-6">
      <h2 className="font-semibold text-gray-900 mb-2">Confirmar Baixa no Estoque</h2>
      <p className="text-sm text-gray-500 mb-4">
        Confira os dados abaixo e confirme para concluir o atendimento.
      </p>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      {stock.length === 0 && (
        <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-lg text-sm mb-4">
          Nenhum lote com estoque disponível nesta unidade. Solicite abastecimento à matriz.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lote *</label>
          {stock.length === 1 ? (
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800">
              {stock[0].productName} – Lote {stock[0].batchNumber} ({stock[0].balance} disponíveis)
            </div>
          ) : (
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Selecione o lote...</option>
              {stock.map((s) => (
                <option key={s.batchId} value={s.batchId}>
                  {s.productName} – Lote {s.batchNumber} ({s.balance} disponíveis)
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Palhetas Utilizadas *</label>
          <input
            type="number" min="1" max={selected?.balance || 999} value={strawsUsed}
            onChange={(e) => setStrawsUsed(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Quantidade"
          />
          {cellQuantity && (
            <p className="text-xs text-gray-400 mt-1">Prontuário indica: {cellQuantity}</p>
          )}
        </div>
      </div>

      {selected && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-600">
          Saldo atual: <strong>{selected.balance}</strong> palhetas → Após baixa: <strong>{selected.balance - (parseInt(strawsUsed) || 0)}</strong> palhetas
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setOpen(false)}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={handleComplete} disabled={loading || !batchId || !strawsUsed || stock.length === 0}
          className="flex-1 bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {loading ? "Processando..." : "Confirmar Baixa"}
        </button>
      </div>
    </div>
  );
}
