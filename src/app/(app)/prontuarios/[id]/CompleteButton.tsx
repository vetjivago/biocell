"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Plus, Trash2 } from "lucide-react";

interface StockItem {
  batchId: string;
  batchNumber: string;
  productName: string;
  category: string;
  balance: number;
}

interface CategoryItem {
  batchId: string;
  quantity: string;
}

const CATEGORIES = [
  { key: "CELULAS", label: "Células-Tronco", unit: "palhetas", required: true },
  { key: "MEIO", label: "Meio de Preparo", unit: "unidades", required: true },
  { key: "SORO", label: "Soro", unit: "unidades", required: true },
];

function parseQuantity(cellQuantity: string | null): string {
  if (!cellQuantity) return "";
  const match = cellQuantity.match(/(\d+)/);
  return match ? match[1] : "";
}

export default function CompleteButton({
  recordId,
  unitId,
  cellQuantity,
  meioQuantity,
  soroQuantity,
}: {
  recordId: string;
  unitId: string;
  cellQuantity: string | null;
  meioQuantity?: number | null;
  soroQuantity?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [items, setItems] = useState<Record<string, CategoryItem[]>>({
    CELULAS: [{ batchId: "", quantity: "" }],
    MEIO: [{ batchId: "", quantity: "" }],
    SORO: [{ batchId: "", quantity: "" }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetch(`/api/inventory/stock?unitId=${unitId}`)
        .then((r) => r.json())
        .then((data: StockItem[]) => {
          setStock(data);
          const celulas = data.filter((s) => s.category === "CELULAS");
          const meio = data.filter((s) => s.category === "MEIO");
          const soro = data.filter((s) => s.category === "SORO");
          setItems({
            CELULAS: [{
              batchId: celulas.length === 1 ? celulas[0].batchId : "",
              quantity: parseQuantity(cellQuantity),
            }],
            MEIO: [{
              batchId: meio.length === 1 ? meio[0].batchId : "",
              quantity: meioQuantity ? meioQuantity.toString() : "",
            }],
            SORO: [{
              batchId: soro.length === 1 ? soro[0].batchId : "",
              quantity: soroQuantity ? soroQuantity.toString() : "",
            }],
          });
        });
    }
  }, [open, unitId, cellQuantity, meioQuantity, soroQuantity]);

  function updateRow(cat: string, index: number, field: "batchId" | "quantity", value: string) {
    setItems((prev) => ({
      ...prev,
      [cat]: prev[cat].map((row, i) => i === index ? { ...row, [field]: value } : row),
    }));
  }

  function addRow(cat: string) {
    setItems((prev) => ({
      ...prev,
      [cat]: [...prev[cat], { batchId: "", quantity: "" }],
    }));
  }

  function removeRow(cat: string, index: number) {
    setItems((prev) => ({
      ...prev,
      [cat]: prev[cat].filter((_, i) => i !== index),
    }));
  }

  async function handleComplete() {
    for (const cat of CATEGORIES) {
      if (!cat.required) continue;
      const rows = items[cat.key].filter((r) => r.batchId && r.quantity && parseInt(r.quantity) > 0);
      if (rows.length === 0) {
        setError(`Preencha ao menos um lote e quantidade de ${cat.label}`);
        return;
      }
    }
    setLoading(true);
    setError("");

    const consumptionItems = CATEGORIES.flatMap((c) =>
      items[c.key]
        .filter((r) => r.batchId && r.quantity && parseInt(r.quantity) > 0)
        .map((r) => ({
          batchId: r.batchId,
          quantity: parseInt(r.quantity),
          category: c.key,
        }))
    );

    const res = await fetch(`/api/medical-records/${recordId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: consumptionItems }),
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

  const allRequiredValid = CATEGORIES.every((c) =>
    !c.required || items[c.key].some((r) => r.batchId && r.quantity && parseInt(r.quantity) > 0)
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-primary p-6">
      <h2 className="font-semibold text-gray-900 mb-2">Confirmar Baixa no Estoque</h2>
      <p className="text-sm text-gray-500 mb-4">
        Preencha a quantidade utilizada de cada item. Todos são obrigatórios.
      </p>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      <div className="space-y-4 mb-4">
        {CATEGORIES.map((cat) => {
          const catStock = stock.filter((s) => s.category === cat.key);
          const rows = items[cat.key];
          const usedBatchIds = rows.map((r) => r.batchId).filter(Boolean);

          if (catStock.length === 0 && !cat.required) return null;

          return (
            <div key={cat.key} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-800">
                  {cat.label} *
                </p>
                {catStock.length > 1 && (
                  <button
                    type="button"
                    onClick={() => addRow(cat.key)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={12} />
                    Adicionar lote
                  </button>
                )}
              </div>

              {catStock.length === 0 ? (
                <p className="text-xs text-amber-600">
                  Nenhum lote de {cat.label.toLowerCase()} disponível. Solicite abastecimento à matriz.
                </p>
              ) : (
                <div className="space-y-3">
                  {rows.map((row, idx) => {
                    const availableBatches = catStock.filter(
                      (s) => s.batchId === row.batchId || !usedBatchIds.includes(s.batchId)
                    );
                    const selected = catStock.find((s) => s.batchId === row.batchId);
                    const showAutoSelect = availableBatches.length === 1 && rows.length === 1;

                    return (
                      <div key={idx} className="flex gap-3 items-start">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Lote</label>
                            {showAutoSelect ? (
                              <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800">
                                {availableBatches[0].productName} – {availableBatches[0].batchNumber} ({availableBatches[0].balance} disp.)
                              </div>
                            ) : (
                              <select
                                value={row.batchId}
                                onChange={(e) => updateRow(cat.key, idx, "batchId", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="">Selecione...</option>
                                {availableBatches.map((s) => (
                                  <option key={s.batchId} value={s.batchId}>
                                    {s.productName} – {s.batchNumber} ({s.balance} disp.)
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Quantidade ({cat.unit})</label>
                            <input
                              type="number"
                              min="1"
                              max={selected?.balance || 999}
                              value={row.quantity}
                              onChange={(e) => updateRow(cat.key, idx, "quantity", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="Qtd"
                            />
                            {idx === 0 && cat.key === "CELULAS" && cellQuantity && (
                              <p className="text-xs text-gray-400 mt-1">Prontuário: {cellQuantity}</p>
                            )}
                          </div>
                        </div>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(cat.key, idx)}
                            className="mt-6 p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {rows.some((r) => r.batchId && r.quantity) && (
                    <p className="text-xs text-gray-500">
                      Total {cat.label.toLowerCase()}: {rows.reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0)} {cat.unit}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={() => setOpen(false)}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={handleComplete} disabled={loading || !allRequiredValid}
          className="flex-1 bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {loading ? "Processando..." : "Confirmar Baixa"}
        </button>
      </div>
    </div>
  );
}
