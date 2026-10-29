"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { formatBRL, formatMoneyInput, parseMoney } from "@/lib/sales-types";

type Item = { id: string; name: string; price: number | null; active: boolean };

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro ao salvar");
  return data;
}

// Valor vazio = preço livre; preenchido errado = erro
const invalid = (v: string) => v.trim() !== "" && parseMoney(v) === null;

export default function PriceTable({ items }: { items: Item[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", price: "" });
  const [editing, setEditing] = useState<{ id: string; name: string; price: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError("");
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => send("/api/price-items", "POST", form), () => setForm({ name: "", price: "" }));
        }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6"
      >
        <h2 className="font-semibold text-gray-900 mb-3">Novo item</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Produto ou serviço" className={input} />
          <input inputMode="decimal" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="Valor (R$) ou em branco"
            className={`${input} ${invalid(form.price) ? "border-red-400" : ""}`} />
          <button type="submit" disabled={busy || !form.name.trim() || invalid(form.price)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-medium disabled:opacity-50">
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Item</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Valor</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Situação</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) =>
              editing?.id === i.id ? (
                <tr key={i.id} className="border-b border-gray-50 bg-gray-50">
                  <td className="px-4 py-2"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Nome" className={input} /></td>
                  <td className="px-4 py-2 w-44">
                    <input inputMode="decimal" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} placeholder="Livre" aria-label="Valor"
                      className={`${input} ${invalid(editing.price) ? "border-red-400" : ""}`} />
                  </td>
                  <td className="px-4 py-2" colSpan={2}>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">Cancelar</button>
                      <button type="button" disabled={busy || !editing.name.trim() || invalid(editing.price)}
                        onClick={() => run(() => send(`/api/price-items/${i.id}`, "PATCH", { name: editing.name, price: editing.price }), () => setEditing(null))}
                        className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">Salvar</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={i.id} className={`border-b border-gray-50 ${i.active ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {i.price !== null ? (
                      <span className="flex items-center gap-1.5 text-gray-900"><Lock size={12} className="text-gray-400" /> {formatBRL(i.price)}</span>
                    ) : (
                      <span className="text-gray-400">Livre</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={i.active} disabled={busy}
                        onChange={(e) => run(() => send(`/api/price-items/${i.id}`, "PATCH", { active: e.target.checked }))}
                        className="rounded border-gray-300" />
                      {i.active ? "Ativo" : "Inativo"}
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" aria-label={`Editar ${i.name}`}
                        onClick={() => setEditing({ id: i.id, name: i.name, price: i.price !== null ? formatMoneyInput(i.price) : "" })}
                        className="p-2 text-gray-400 hover:text-primary"><Pencil size={16} /></button>
                      <button type="button" aria-label={`Excluir ${i.name}`} disabled={busy}
                        onClick={() => {
                          if (confirm(`Excluir “${i.name}” da tabela de preços? Orçamentos já feitos não mudam.`)) run(() => send(`/api/price-items/${i.id}`, "DELETE"));
                        }}
                        className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">Nenhum item na tabela de preços</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
