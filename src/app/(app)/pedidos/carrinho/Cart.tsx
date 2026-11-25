"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { standardProduct } from "@/lib/products";
import { MIN_STRAWS, RACKS, type Racks, brl, calculateOrder, isCellItem, strawsOf } from "@/lib/purchase-orders";
import { lineName, lineStock, storeProduct } from "@/lib/store";
import { useCart } from "../cart";
import { ProductImage } from "../loja/StoreFront";

type Unit = { id: string; name: string };

// Carrinho: confere as raques (mínimo de 48 palhetas), mostra o kit da OS que vai junto
// (calculado pelo estoque da unidade) e fecha o pedido
export default function Cart({ userId, units, isAdmin }: { userId: string; units: Unit[]; isAdmin: boolean }) {
  const router = useRouter();
  const { lines, setQty, clear } = useCart(userId);
  const [unitId, setUnitId] = useState(units.length === 1 ? units[0].id : "");
  const [stock, setStock] = useState<{ unitId: string; data: Record<string, number> } | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!unitId) return;
    let cancel = false;
    fetch(`/api/purchase-orders/stock?unitId=${encodeURIComponent(unitId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { if (!cancel) setStock({ unitId, data }); })
      .catch(() => { if (!cancel) setError("Não foi possível ler o estoque da unidade"); });
    return () => { cancel = true; };
  }, [unitId]);

  const racks = useMemo(() => {
    const r = Object.fromEntries(RACKS.map((x) => [x.key, 0])) as Racks;
    for (const l of lines) { const k = storeProduct(l.productId)?.rack; if (k) r[k] += l.quantity; }
    return r;
  }, [lines]);
  const straws = strawsOf(racks);
  const belowMin = straws > 0 && straws < MIN_STRAWS;
  const subtotal = lines.reduce((s, l) => s + l.quantity * (storeProduct(l.productId)?.price || 0), 0);

  const currentStock = stock && stock.unitId === unitId ? stock.data : null;
  const kit = useMemo(() => {
    if (!currentStock) return null;
    const extras: Record<string, number> = {};
    for (const l of lines) for (const s of lineStock(l)) extras[s.productId] = (extras[s.productId] || 0) + s.qty;
    return calculateOrder(currentStock, racks).items
      .filter((i) => !isCellItem(i.productId))
      .map((i) => ({ ...i, extra: extras[i.productId] || 0 }))
      .filter((i) => i.calculated + i.extra > 0);
  }, [currentStock, lines, racks]);

  async function checkout() {
    setError("");
    if (!unitId) return setError("Escolha a unidade do pedido");
    if (belowMin && !isAdmin) return setError(`Pedido de células: mínimo de ${MIN_STRAWS} palhetas (pode misturar espécies). No carrinho: ${straws}`);
    setLoading(true);
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId, lines, notes }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error || "Erro ao fechar o pedido");
    clear();
    router.push(`/pedidos/${data.id}`);
    router.refresh();
  }

  if (!lines.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-600">Seu carrinho está vazio</p>
        <Link href="/pedidos/loja" className="inline-block mt-4 bg-primary text-white px-5 py-2 rounded-lg text-sm">Ver produtos</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-5 items-start">
      <div className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="font-semibold text-gray-900 px-4 pt-4 pb-2">Carrinho</p>
          <div className="divide-y divide-gray-50">
            {lines.map((l, i) => {
              const p = storeProduct(l.productId)!;
              return (
                <div key={`${l.productId}-${l.variant}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <ProductImage p={p} className="w-14 h-14 rounded-lg" />
                  <div className="flex-1 min-w-[10rem]">
                    <p className="text-sm text-gray-900">{lineName(p, l.variant)}</p>
                    <p className="text-xs text-gray-500">{brl(p.price)} cada</p>
                  </div>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button onClick={() => setQty(i, l.quantity - 1)} aria-label="Menos" className="p-2 text-gray-600"><Minus size={12} /></button>
                    <input type="number" min="0" value={l.quantity} onChange={(e) => setQty(i, parseInt(e.target.value) || 0)} aria-label={`Quantidade de ${p.name}`}
                      className="w-14 text-center text-sm border-x border-gray-300 py-1.5" />
                    <button onClick={() => setQty(i, l.quantity + 1)} aria-label="Mais" className="p-2 text-gray-600"><Plus size={12} /></button>
                  </div>
                  <p className="w-24 text-right text-sm font-medium text-gray-900">{brl(p.price * l.quantity)}</p>
                  <button onClick={() => setQty(i, 0)} aria-label="Remover" className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between text-sm">
            <Link href="/pedidos/loja" className="text-primary hover:underline">Continuar comprando</Link>
            <button onClick={clear} className="text-gray-500 hover:text-red-600">Esvaziar carrinho</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-4 pt-4 pb-2">
            <p className="font-semibold text-gray-900">Vai junto com as células (kit da OS de reposição)</p>
            <p className="text-xs text-gray-500">Calculado pelas raques e pelo estoque atual da unidade, sem custo. O que você comprou na loja aparece como extra.</p>
          </div>
          {!unitId ? (
            <p className="px-4 pb-4 text-sm text-gray-400">Escolha a unidade para calcular.</p>
          ) : !kit ? (
            <p className="px-4 pb-4 text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Lendo o estoque da unidade...</p>
          ) : kit.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-gray-400">Nenhum item calculado (sem raques no carrinho ou estoque já completo).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y border-gray-100 text-xs text-gray-500">
                    <th className="text-left px-4 py-2">Item</th>
                    <th className="text-right px-3 py-2">Em estoque</th>
                    <th className="text-right px-3 py-2">Calculado</th>
                    <th className="text-right px-3 py-2">Extra</th>
                    <th className="text-right px-4 py-2">Total a enviar</th>
                  </tr>
                </thead>
                <tbody>
                  {kit.map((i) => (
                    <tr key={i.productId} className="border-b border-gray-50">
                      <td className="px-4 py-1.5">{standardProduct(i.productId)?.name}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{i.stock}</td>
                      <td className="px-3 py-1.5 text-right">{i.calculated}</td>
                      <td className="px-3 py-1.5 text-right">{i.extra || ""}</td>
                      <td className="px-4 py-1.5 text-right font-medium">{i.calculated + i.extra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4 lg:sticky lg:top-4">
        <p className="font-semibold text-gray-900">Resumo do pedido</p>
        {units.length !== 1 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione a unidade...</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        ) : <p className="text-sm text-gray-700">{units[0]?.name}</p>}
        <div className={`text-sm rounded-lg px-3 py-2 ${belowMin ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-700"}`}>
          Células: <strong>{straws}</strong> palhetas
          {belowMin && <> — mínimo de {MIN_STRAWS} (faltam {MIN_STRAWS - straws}){isAdmin ? "; a matriz pode lançar assim mesmo" : ""}</>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Ex.: preciso receber até dia 20; envio aéreo" />
        </div>
        <div className="border-t border-gray-100 pt-3 text-sm space-y-1">
          <p className="flex justify-between"><span>Subtotal</span><strong>{brl(subtotal)}</strong></p>
          <p className="text-xs text-gray-500">Frete, gelo seco, desconto e forma de pagamento são definidos pela matriz.</p>
        </div>
        <button onClick={checkout} disabled={loading || (!!unitId && !kit)}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
          {loading ? "Enviando..." : "Finalizar pedido"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
