"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";

type Unit = { id: string; name: string };
type Batch = {
  id: string;
  batchNumber: string;
  product: { name: string; code: string | null; species: string | null };
};

export default function SupplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedUnitId = searchParams.get("unitId") || "";
  const autoOpen = searchParams.get("supply") === "true";

  const [open, setOpen] = useState(autoOpen);
  const [units, setUnits] = useState<Unit[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [unitId, setUnitId] = useState(preselectedUnitId);
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/units").then((r) => r.json()),
      fetch("/api/batches").then((r) => r.json()),
    ]).then(([u, b]) => {
      setUnits(u);
      setBatches(b);
    });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      setError("Quantidade deve ser maior que zero");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId,
        batchId,
        type: "RECEIPT",
        quantity: qty,
        reason: reason || "Abastecimento pela matriz",
      }),
    });

    if (res.ok) {
      setSuccess("Estoque atualizado com sucesso!");
      setUnitId("");
      setBatchId("");
      setQuantity("");
      setReason("");
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setSuccess("");
      }, 1500);
    } else {
      const data = await res.json();
      setError(data.error || "Erro ao atualizar estoque");
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
      >
        <Plus size={18} />
        Abastecer Unidade
      </button>
    );
  }

  const selectedBatch = batches.find((b) => b.id === batchId);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Abastecer Unidade</h2>
        <button onClick={() => { setOpen(false); setError(""); setSuccess(""); }} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">Selecione a unidade...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Produto / Lote</label>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">Selecione o lote...</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.product.name} – Lote {b.batchNumber} {b.product.species ? `(${b.product.species})` : ""}
              </option>
            ))}
          </select>
          {selectedBatch && (
            <p className="text-xs text-gray-400 mt-1">
              {selectedBatch.product.name} {selectedBatch.product.code ? `(${selectedBatch.product.code})` : ""}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Palhetas</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            placeholder="Ex: 10"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Envio pedido #123"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {loading ? "Salvando..." : "Registrar Abastecimento"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </div>
      </form>
    </div>
  );
}
