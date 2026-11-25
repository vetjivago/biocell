"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, ShoppingCart } from "lucide-react";
import { standardProduct } from "@/lib/products";
import { ITEM_PRICES, MIN_STRAWS, RACKS, STRAW_PRICE, type Racks, brl, calculateOrder, isCellItem, orderTotals, strawsOf, suggestedExtra } from "@/lib/purchase-orders";

type Unit = { id: string; name: string };
const field = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary";

export default function NewPurchaseForm({ units, isAdmin }: { units: Unit[]; isAdmin: boolean }) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(units.length === 1 ? units[0].id : "");
  const [stock, setStock] = useState<Record<string, number> | null>(null);
  const [racks, setRacks] = useState<Racks>({ racksCanine: 0, racksFeline: 0, racksEquine: 0 });
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!unitId) return;
    let cancel = false;
    fetch(`/api/purchase-orders/stock?unitId=${encodeURIComponent(unitId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s) => { if (!cancel) setStock(s); })
      .catch(() => { if (!cancel) setError("Não foi possível ler o estoque da unidade"); });
    return () => { cancel = true; };
  }, [unitId]);

  const straws = strawsOf(racks);
  const calc = useMemo(() => (stock ? calculateOrder(stock, racks) : null), [stock, racks]);
  const rows = (calc?.items ?? []).map((i) => {
    const extra = isCellItem(i.productId) ? 0 : Math.max(0, parseInt(extras[i.productId] || "0") || 0);
    return { ...i, extra, quantity: i.calculated + extra };
  });
  const totals = orderTotals({ items: rows, dryIce: false, dryIceQty: 0, freight: 0, extraValue: suggestedExtra(rows), discount: 0 });
  const belowMin = straws > 0 && straws < MIN_STRAWS;

  const setRack = (key: keyof Racks, n: number) => setRacks((r) => ({ ...r, [key]: Math.max(0, Math.min(100, n)) }));

  async function submit() {
    setError("");
    if (!unitId) return setError("Escolha a unidade");
    if (belowMin && !isAdmin) return setError(`Pedido de células: mínimo de ${MIN_STRAWS} palhetas (pode misturar espécies)`);
    if (!rows.some((r) => r.quantity > 0)) return setError("O pedido está vazio: informe as raques ou algum item extra");
    setLoading(true);
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId, racks, notes,
        extras: Object.fromEntries(rows.filter((r) => r.extra > 0).map((r) => [r.productId, r.extra])),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error || "Erro ao enviar o pedido");
    router.push(`/pedidos/${data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {units.length !== 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
          <select value={unitId} onChange={(e) => { setStock(null); setUnitId(e.target.value); }} className={field}>
            <option value="">Selecione a unidade...</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Células-tronco (raques)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Mínimo de {MIN_STRAWS} palhetas por pedido, não precisa ser da mesma espécie · {brl(STRAW_PRICE)} por palheta
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {RACKS.map((r) => (
            <div key={r.key} className="border border-gray-200 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900">{r.label}</p>
              <p className="text-xs text-gray-500 mb-2">Raque com {r.strawsPerRack} palhetas · {brl(r.strawsPerRack * STRAW_PRICE)}</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setRack(r.key, racks[r.key] - 1)} aria-label={`Menos raques de ${r.label}`}
                  className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"><Minus size={14} /></button>
                <input type="number" min="0" inputMode="numeric" value={racks[r.key]} aria-label={`Raques de ${r.label}`}
                  onChange={(e) => setRack(r.key, parseInt(e.target.value) || 0)} className={`${field} text-center`} />
                <button type="button" onClick={() => setRack(r.key, racks[r.key] + 1)} aria-label={`Mais raques de ${r.label}`}
                  className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"><Plus size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <p className={`text-sm mt-3 ${belowMin ? "text-amber-700" : "text-gray-600"}`}>
          Total: <strong>{straws}</strong> palhetas
          {belowMin && ` — faltam ${MIN_STRAWS - straws} para o mínimo${isAdmin ? " (a matriz pode lançar assim mesmo)" : ""}`}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="p-5 pb-3">
          <h2 className="font-semibold text-gray-900">Itens que vão junto</h2>
          <p className="text-xs text-gray-500">
            Calculado pela regra da OS de reposição, descontando o estoque da unidade. Use &quot;Extra&quot; para pedir a mais (meios e soros extras, caixa de isopor, ringer, equipo).
          </p>
        </div>
        {!unitId ? (
          <p className="px-5 pb-5 text-sm text-gray-400">Escolha a unidade para calcular.</p>
        ) : !calc ? (
          <p className="px-5 pb-5 text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Lendo o estoque da unidade...</p>
        ) : (
          <table className="w-full min-w-[640px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Item</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Em estoque</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Calculado</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2 w-28">Extra</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Total a enviar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = standardProduct(r.productId);
                const cell = isCellItem(r.productId);
                return (
                  <tr key={r.productId} className={`border-b border-gray-50 ${r.quantity > 0 ? "" : "text-gray-400"}`}>
                    <td className="px-4 py-2 text-sm">
                      <span className={r.quantity > 0 ? "text-gray-900" : ""}>{p?.name}</span>
                      <span className="text-xs text-gray-400"> · {p?.presentation}</span>
                      {r.onRequest && <span className="text-xs text-gray-400"> · só se pedir</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">{r.stock}</td>
                    <td className="px-4 py-2 text-sm text-right">{r.calculated}</td>
                    <td className="px-4 py-1.5 text-right">
                      {cell ? <span className="text-xs text-gray-400">por raque</span> : (
                        <input type="number" min="0" inputMode="numeric" value={extras[r.productId] ?? ""} placeholder="0"
                          aria-label={`Extra de ${p?.name}`} title={ITEM_PRICES[r.productId] ? `${brl(ITEM_PRICES[r.productId])} cada` : undefined}
                          onChange={(e) => setExtras((x) => ({ ...x, [r.productId]: e.target.value }))}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right" />
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">{r.quantity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={field}
            placeholder="Ex.: preciso receber até dia 20; enviar por via aérea" />
        </div>
        <div className="text-sm text-gray-700 space-y-1">
          <p>Células: <strong>{brl(totals.cells)}</strong></p>
          {totals.box + totals.ringer + totals.equipo > 0 && <p>Isopor, ringer e equipo: <strong>{brl(totals.box + totals.ringer + totals.equipo)}</strong></p>}
          {suggestedExtra(rows) > 0 && <p>Extras: <strong>{brl(suggestedExtra(rows))}</strong></p>}
          <p className="text-base">Estimativa: <strong>{brl(totals.total)}</strong> <span className="text-xs text-gray-500">(frete, gelo seco e condições de pagamento são definidos pela matriz)</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={submit} disabled={loading || !calc}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
            {loading ? "Enviando..." : "Enviar pedido"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
