"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Minus, Plus, Search, Trash2 } from "lucide-react";
import { fold, formatBRL, formatMoneyInput, parseMoney } from "@/lib/sales-types";

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-xs font-medium text-gray-500 mb-1";

type Suggestion = { description: string; unitPrice: number; fixed: boolean; catalog: boolean };
type Item = { key: number; description: string; quantity: number; unitPrice: string };
export type SaleFormInitial = {
  items: { description: string; quantity: number; unitPrice: number }[];
  validUntil: string;
  notes: string;
  discount: number;
};

let nextKey = 1;

export default function SaleForm({ patientId, saleId, initial }: { patientId: string; saleId?: string; initial: SaleFormInitial }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(() =>
    initial.items.map((i) => ({ key: nextKey++, description: i.description, quantity: i.quantity, unitPrice: formatMoneyInput(i.unitPrice) }))
  );
  const [validUntil, setValidUntil] = useState(initial.validUntil);
  const [notes, setNotes] = useState(initial.notes);
  const [discount, setDiscount] = useState(initial.discount ? formatMoneyInput(initial.discount) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Busca de produto/serviço (como no SimplesVet): quantidade + nome; clique na linha para adicionar
  const [qty, setQty] = useState(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const searchSeq = useRef(0);
  // Tabela de preços da matriz: os mais usados aparecem de cara; com valor fixo, o preço fica travado
  const [catalog, setCatalog] = useState<Suggestion[]>([]);
  const fixedPrice = (description: string) => catalog.find((c) => c.fixed && fold(c.description) === fold(description))?.unitPrice;

  useEffect(() => {
    fetch("/api/sales/items").then((r) => r.json()).then((d) => setCatalog(d.items || [])).catch(() => {});
  }, []);

  async function search(q: string) {
    const seq = ++searchSeq.current;
    const res = await fetch(`/api/sales/items?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    if (seq === searchSeq.current) setResults(res.ok ? data.items || [] : []);
  }

  useEffect(() => {
    if (!query.trim()) return;
    const t = setTimeout(() => search(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  function addItem(description: string, unitPrice: number) {
    setItems((list) => [...list, { key: nextKey++, description, quantity: qty, unitPrice: formatMoneyInput(unitPrice) }]);
    setQuery("");
    setResults(null);
    setQty(1);
  }

  const update = (key: number, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  // Preço do item: o fixo da tabela, se houver; senão o digitado
  const priceOf = (i: Item) => fixedPrice(i.description) ?? parseMoney(i.unitPrice);
  const subtotal = items.reduce((s, i) => s + i.quantity * (priceOf(i) ?? 0), 0);
  const discountCents = parseMoney(discount) ?? 0;
  const total = Math.max(0, subtotal - discountCents);
  const typed = query.trim();
  const exact = results?.some((r) => r.description.toLocaleLowerCase("pt-BR") === typed.toLocaleLowerCase("pt-BR"));

  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = {
        patientId,
        items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: fixedPrice(i.description) !== undefined ? formatMoneyInput(fixedPrice(i.description)!) : i.unitPrice })),
        validUntil: validUntil || null,
        notes,
        discount,
      };
      const res = await fetch(saleId ? `/api/sales/${saleId}` : "/api/sales", {
        method: saleId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleId ? { action: "update", ...body } : body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
      router.push(`/pacientes/${patientId}/orcamentos/${saleId || data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Adicionar item</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typed) search(typed);
          }}
          className="flex flex-wrap items-stretch gap-2"
        >
          <div className="flex items-stretch border border-gray-300 rounded-lg overflow-hidden">
            <button type="button" aria-label="Diminuir quantidade" onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-2.5 bg-gray-50 hover:bg-gray-100"><Minus size={14} /></button>
            <input type="number" min={1} max={9999} value={qty} aria-label="Quantidade"
              onChange={(e) => setQty(Math.min(9999, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
              className="w-14 text-center text-sm border-x border-gray-300" />
            <button type="button" aria-label="Aumentar quantidade" onClick={() => setQty((q) => Math.min(9999, q + 1))} className="px-2.5 bg-gray-50 hover:bg-gray-100"><Plus size={14} /></button>
          </div>
          <input value={query} onChange={(e) => { setQuery(e.target.value); if (!e.target.value.trim()) setResults(null); }}
            placeholder="Produto ou serviço" className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700">
            <Search size={14} /> Pesquisar
          </button>
        </form>

        {typed && results !== null && (
          <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
            <p className="px-3 py-2 bg-blue-50 text-blue-800 text-xs">Para selecionar, clique na linha.</p>
            <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {results.map((r) => (
                <li key={r.description}>
                  <button type="button" onClick={() => addItem(r.description, r.unitPrice)}
                    className="w-full flex justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50">
                    <span className="text-gray-800">{r.description}</span>
                    <span className="text-gray-600 shrink-0 flex items-center gap-1">
                      {r.fixed && <Lock size={12} className="text-gray-400" />}
                      {r.fixed || r.unitPrice ? formatBRL(r.unitPrice) : "valor livre"}
                    </span>
                  </button>
                </li>
              ))}
              {!exact && (
                <li>
                  <button type="button" onClick={() => addItem(typed, 0)}
                    className="w-full flex items-center gap-1.5 px-3 py-2.5 text-left text-sm text-primary hover:bg-gray-50">
                    <Plus size={14} /> Adicionar “{typed}” como novo item
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
        {!typed && catalog.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Mais usados (clique para adicionar)</p>
            <div className="flex flex-wrap gap-2">
              {catalog.map((c) => (
                <button key={c.description} type="button" onClick={() => addItem(c.description, c.unitPrice)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-700 hover:border-primary hover:bg-primary/5">
                  <Plus size={12} /> {c.description}
                  <span className="text-gray-500">{c.fixed ? formatBRL(c.unitPrice) : "valor livre"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {!typed && (
          <p className="mt-3 px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-xs">
            Digite o nome do produto ou serviço. Aparecem os itens da tabela de preços e os já usados em outros orçamentos, com o último valor; se não existir, adicione como novo item.
            Itens com <Lock size={10} className="inline" /> têm valor fixo definido pela matriz.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Itens do orçamento</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Nenhum item adicionado ainda.</p>
        ) : (
          <div className="space-y-3">
            <div className="hidden sm:grid grid-cols-[1fr_90px_130px_110px_36px] gap-2 text-xs font-medium text-gray-500 px-1">
              <span>Descrição</span><span>Qtd.</span><span>Valor unit. (R$)</span><span className="text-right">Total</span><span />
            </div>
            {items.map((i) => {
              const fixed = fixedPrice(i.description);
              return (
              <div key={i.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_90px_130px_110px_36px] gap-2 items-center border-b sm:border-0 border-gray-100 pb-3 sm:pb-0">
                <input value={i.description} onChange={(e) => update(i.key, { description: e.target.value })} aria-label="Descrição"
                  readOnly={fixed !== undefined} className={`${input} col-span-2 sm:col-span-1 ${fixed !== undefined ? "bg-gray-50" : ""}`} />
                <input type="number" min={1} max={9999} value={i.quantity} aria-label="Quantidade"
                  onChange={(e) => update(i.key, { quantity: Math.min(9999, Math.max(1, Math.floor(Number(e.target.value) || 1))) })}
                  className={input} />
                {fixed !== undefined ? (
                  <span className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700" title="Valor fixo da tabela de preços">
                    <Lock size={12} className="text-gray-400" /> {formatMoneyInput(fixed)}
                  </span>
                ) : (
                  <input inputMode="decimal" value={i.unitPrice} onChange={(e) => update(i.key, { unitPrice: e.target.value })} aria-label="Valor unitário"
                    className={`${input} ${parseMoney(i.unitPrice) === null ? "border-red-400" : ""}`} />
                )}
                <span className="text-sm text-right text-gray-800">{formatBRL(i.quantity * (priceOf(i) ?? 0))}</span>
                <button type="button" aria-label={`Remover ${i.description}`} onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                  className="justify-self-end p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className={label}>Validade do orçamento</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Desconto (R$)</label>
              <input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00"
                className={`${input} ${parseMoney(discount) === null ? "border-red-400" : ""}`} />
            </div>
          </div>
          <div className="text-sm space-y-1 sm:text-right self-end">
            <p className="text-gray-600">Subtotal: <span className="font-medium text-gray-900">{formatBRL(subtotal)}</span></p>
            {discountCents > 0 && <p className="text-gray-600">Desconto: <span className="font-medium text-gray-900">− {formatBRL(discountCents)}</span></p>}
            <p className="text-lg font-bold text-gray-900">Total: {formatBRL(total)}</p>
          </div>
        </div>

        <div className="mt-4">
          <label className={label}>Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={input}
            placeholder="Ex: protocolo de 4 aplicações; valores sujeitos a alteração após a validade" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
        <button type="button" onClick={save} disabled={busy || items.length === 0}
          className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {busy ? "Salvando..." : "Salvar orçamento"}
        </button>
      </div>
    </div>
  );
}
