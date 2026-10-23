"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X, Loader2, Trash2 } from "lucide-react";
import { NO_LOT, PRODUCT_CATEGORIES, STANDARD_PRODUCTS, standardProduct } from "@/lib/products";

type Unit = { id: string; name: string };
type Batch = { id: string; batchNumber: string; product: { id: string } };
type Row = { productId: string; batchNumber: string; quantity: string };

const emptyRow = (): Row => ({ productId: "", batchNumber: "", quantity: "" });
const field = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary";

// Abastecimento: vários itens do catálogo de uma vez (como na OS de reposição da UABC)
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
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
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

  const updateRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function close() {
    setOpen(false);
    setError("");
    setSuccess("");
    setRows([emptyRow()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const filled = rows.filter((r) => r.productId);
    if (filled.length === 0) return setError("Adicione ao menos um produto");
    for (const r of filled) {
      const p = standardProduct(r.productId)!;
      if (!(parseInt(r.quantity) > 0)) return setError(`${p.name}: quantidade deve ser maior que zero`);
      if (p.category !== "MATERIAL" && !r.batchNumber.trim()) return setError(`${p.name}: informe o lote`);
    }

    setLoading(true);
    // Um registro por item; os que deram certo saem da lista, os com erro ficam para corrigir
    const failed: Row[] = [];
    const errors: string[] = [];
    for (const r of filled) {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          type: "RECEIPT",
          productId: r.productId,
          batchNumber: r.batchNumber,
          quantity: parseInt(r.quantity),
          reason: reason || "Abastecimento pela matriz",
        }),
      });
      if (!res.ok) {
        failed.push(r);
        const data = await res.json().catch(() => ({}));
        errors.push(`${standardProduct(r.productId)?.name}: ${data.error || "erro ao registrar"}`);
      }
    }
    setLoading(false);
    router.refresh();

    if (failed.length > 0) {
      setRows(failed);
      setError(errors.join(" • "));
      return;
    }
    setSuccess(`Abastecimento registrado (${filled.length} ${filled.length === 1 ? "item" : "itens"})!`);
    setRows([emptyRow()]);
    setReason("");
    setTimeout(close, 1500);
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

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-gray-900">Abastecer Unidade</h2>
        <button onClick={close} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required className={field}>
              <option value="">Selecione a unidade...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: OS de reposição 14/10" className={field} />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Itens enviados</p>
          {rows.map((r, i) => {
            const product = standardProduct(r.productId);
            const isMaterial = product?.category === "MATERIAL";
            const lots = batches.filter((b) => b.product.id === r.productId && b.batchNumber !== NO_LOT);
            const taken = rows.filter((_, j) => j !== i).map((x) => x.productId);
            return (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_12rem_7rem_auto] gap-2 items-start p-3 bg-gray-50 rounded-lg">
                <select value={r.productId} onChange={(e) => updateRow(i, { productId: e.target.value, batchNumber: "" })}
                  aria-label="Produto" className={`${field} bg-white`}>
                  <option value="">Selecione o produto...</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <optgroup key={c.key} label={c.label}>
                      {STANDARD_PRODUCTS.filter((p) => p.category === c.key && !p.legacy).map((p) => (
                        <option key={p.id} value={p.id} disabled={taken.includes(p.id) && p.category === "MATERIAL"}>
                          {p.name}{p.presentation ? ` (${p.presentation})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div>
                  <input type="text" value={r.batchNumber} onChange={(e) => updateRow(i, { batchNumber: e.target.value })}
                    list={`lots-${i}`} disabled={!product}
                    placeholder={isMaterial ? "Lote (opcional)" : "Lote"} aria-label="Lote"
                    className={`${field} bg-white disabled:bg-gray-100`} />
                  <datalist id={`lots-${i}`}>
                    {lots.map((b) => <option key={b.id} value={b.batchNumber} />)}
                  </datalist>
                </div>
                <input type="number" min="1" inputMode="numeric" value={r.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })}
                  placeholder={product?.unit ?? "Qtd"} aria-label="Quantidade" className={`${field} bg-white`} />
                <button type="button" onClick={() => setRows((rs) => (rs.length === 1 ? [emptyRow()] : rs.filter((_, j) => j !== i)))}
                  aria-label="Remover item" className="p-2 text-gray-400 hover:text-red-500 justify-self-end">
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
          <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])}
            className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus size={14} /> Adicionar item
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
