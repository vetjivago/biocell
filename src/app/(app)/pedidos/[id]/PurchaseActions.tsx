"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Receipt, Save, Trash2, Truck, XCircle } from "lucide-react";
import { standardProduct } from "@/lib/products";
import { PAYMENT_METHODS, SHIPPING_MODES, type Lot, brl, needsLot, orderTotals } from "@/lib/purchase-orders";

const field = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary";

async function send(orderId: string, body: object) {
  const res = await fetch(`/api/purchase-orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return res.ok ? null : data.error || "Erro ao salvar";
}

// Unidade: cancelar enquanto aguarda / confirmar que chegou
export function UnitActions({ orderId, canCancel, canDeliver }: { orderId: string; canCancel: boolean; canDeliver: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  async function act(action: string) {
    setBusy(true);
    setError("");
    const err = await send(orderId, { action });
    setBusy(false);
    if (err) return setError(err);
    router.refresh();
  }
  if (!canCancel && !canDeliver) return null;
  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-sm text-red-600">{error}</span>}
      {canDeliver && (
        <button onClick={() => act("deliver")} disabled={busy} className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50">
          <CheckCircle2 size={16} /> Confirmar entrega
        </button>
      )}
      {canCancel && (confirmCancel ? (
        <>
          <span className="text-sm text-gray-600">Cancelar o pedido?</span>
          <button onClick={() => act("cancel")} disabled={busy} className="px-3 py-2 rounded-lg text-sm bg-red-600 text-white disabled:opacity-50">Sim, cancelar</button>
          <button onClick={() => setConfirmCancel(false)} className="px-3 py-2 rounded-lg text-sm border border-gray-200">Não</button>
        </>
      ) : (
        <button onClick={() => setConfirmCancel(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
          <XCircle size={16} /> Cancelar pedido
        </button>
      ))}
    </div>
  );
}

type Item = { id: string; productId: string; calculated: number; quantity: number; lots: Lot[] };
type Order = {
  id: string; status: string; dryIce: boolean; dryIceQty: number; shippingMode: string; carrier: string; freight: number;
  extraValue: number; discount: number; paymentMethod: string; installments: string; adminNotes: string;
};
type ItemState = { id: string; productId: string; calculated: number; quantity: string; lots: { batchNumber: string; quantity: string }[] };

const money = (cents: number) => (cents ? (cents / 100).toFixed(2).replace(".", ",") : "");
const toCents = (v: string) => Math.round((parseFloat(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) || 0) * 100);

// Matriz / logística: ajusta quantidades, informa lotes, logística e financeiro; fatura, envia ou cancela
export function PurchaseEditor({ order, items }: { order: Order; items: Item[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ItemState[]>(items.map((i) => ({
    id: i.id, productId: i.productId, calculated: i.calculated, quantity: String(i.quantity),
    lots: needsLot(i.productId) ? (i.lots.length ? i.lots.map((l) => ({ batchNumber: l.batchNumber, quantity: String(l.quantity) })) : [{ batchNumber: "", quantity: String(i.quantity || "") }]) : [],
  })));
  const [o, setO] = useState({
    dryIce: order.dryIce, dryIceQty: String(order.dryIceQty || ""), shippingMode: order.shippingMode, carrier: order.carrier,
    freight: money(order.freight), extraValue: money(order.extraValue), discount: money(order.discount),
    paymentMethod: order.paymentMethod, installments: order.installments, adminNotes: order.adminNotes,
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [confirm, setConfirm] = useState<"" | "ship" | "cancel">("");

  const setRow = (i: number, patch: Partial<ItemState>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setLot = (i: number, k: number, patch: Partial<{ batchNumber: string; quantity: string }>) =>
    setRow(i, { lots: rows[i].lots.map((l, m) => (m === k ? { ...l, ...patch } : l)) });

  const payload = {
    items: rows.map((r) => ({ id: r.id, quantity: parseInt(r.quantity) || 0, lots: r.lots.map((l) => ({ batchNumber: l.batchNumber, quantity: parseInt(l.quantity) || 0 })) })),
    order: {
      dryIce: o.dryIce, dryIceQty: parseInt(o.dryIceQty) || 0, shippingMode: o.shippingMode, carrier: o.carrier,
      freight: toCents(o.freight), extraValue: toCents(o.extraValue), discount: toCents(o.discount),
      paymentMethod: o.paymentMethod, installments: o.installments, adminNotes: o.adminNotes,
    },
  };
  const totals = orderTotals({
    items: payload.items.map((p, i) => ({ productId: rows[i].productId, quantity: p.quantity, calculated: rows[i].calculated })),
    dryIce: o.dryIce, dryIceQty: payload.order.dryIceQty, freight: payload.order.freight, extraValue: payload.order.extraValue, discount: payload.order.discount,
  });

  async function act(action: "save" | "invoice" | "ship" | "cancel") {
    setBusy(action);
    setError("");
    setOk("");
    const err = await send(order.id, action === "cancel" ? { action } : { action, ...payload });
    setBusy("");
    setConfirm("");
    if (err) return setError(err);
    setOk(action === "save" ? "Alterações salvas" : "");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900">Atendimento do pedido (matriz)</h2>
        <p className="text-xs text-gray-500">Ajuste o que vai, informe os lotes de células, meios e soros e dê andamento. Ao marcar como enviado, os itens entram no estoque da unidade.</p>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const p = standardProduct(r.productId);
          const qty = parseInt(r.quantity) || 0;
          const lotSum = r.lots.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0);
          return (
            <div key={r.id} className={`grid grid-cols-1 md:grid-cols-[1fr_6rem_1.4fr] gap-2 items-start p-2 rounded-lg ${qty > 0 ? "bg-gray-50" : ""}`}>
              <div className="text-sm pt-2">
                <span className={qty > 0 ? "text-gray-900" : "text-gray-400"}>{p?.name}</span>
                <span className="text-xs text-gray-400"> · calculado {r.calculated}</span>
              </div>
              <input type="number" min="0" inputMode="numeric" value={r.quantity} aria-label={`Quantidade de ${p?.name}`}
                onChange={(e) => setRow(i, { quantity: e.target.value })} className={`${field} bg-white text-right`} />
              {needsLot(r.productId) && qty > 0 ? (
                <div className="space-y-1">
                  {r.lots.map((l, k) => (
                    <div key={k} className="flex gap-1">
                      <input value={l.batchNumber} onChange={(e) => setLot(i, k, { batchNumber: e.target.value })} placeholder="Lote (ex.: 04.002.21 LT 210726.1)"
                        aria-label="Lote" className={`${field} bg-white`} />
                      <input type="number" min="1" value={l.quantity} onChange={(e) => setLot(i, k, { quantity: e.target.value })} aria-label="Quantidade do lote"
                        className={`${field} bg-white w-20 text-right`} />
                      {r.lots.length > 1 && (
                        <button type="button" onClick={() => setRow(i, { lots: r.lots.filter((_, m) => m !== k) })} aria-label="Remover lote" className="p-2 text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs">
                    <button type="button" onClick={() => setRow(i, { lots: [...r.lots, { batchNumber: "", quantity: "" }] })} className="flex items-center gap-1 text-primary hover:underline">
                      <Plus size={12} /> outro lote
                    </button>
                    {lotSum !== qty && <span className="text-amber-700">Lotes somam {lotSum} de {qty}</span>}
                  </div>
                </div>
              ) : <div className="hidden md:block" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Logística de envio</label>
          <select value={o.shippingMode} onChange={(e) => setO({ ...o, shippingMode: e.target.value })} className={field}>
            <option value="">—</option>
            {SHIPPING_MODES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Transportadora</label>
          <input value={o.carrier} onChange={(e) => setO({ ...o, carrier: e.target.value })} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Frete (R$)</label>
          <input inputMode="decimal" value={o.freight} onChange={(e) => setO({ ...o, freight: e.target.value })} placeholder="0,00" className={field} />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input type="checkbox" checked={o.dryIce} onChange={(e) => setO({ ...o, dryIce: e.target.checked })} /> Gelo seco
          </label>
          {o.dryIce && <input type="number" min="0" value={o.dryIceQty} onChange={(e) => setO({ ...o, dryIceQty: e.target.value })} placeholder="Qtd." aria-label="Quantidade de gelo seco" className={field} />}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Extra (R$)</label>
          <input inputMode="decimal" value={o.extraValue} onChange={(e) => setO({ ...o, extraValue: e.target.value })} placeholder="0,00" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desconto (R$)</label>
          <input inputMode="decimal" value={o.discount} onChange={(e) => setO({ ...o, discount: e.target.value })} placeholder="0,00" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Forma de pagamento</label>
          <select value={o.paymentMethod} onChange={(e) => setO({ ...o, paymentMethod: e.target.value })} className={field}>
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Parcelas</label>
          <input value={o.installments} onChange={(e) => setO({ ...o, installments: e.target.value })} placeholder="Ex.: 3X (sem juros)" className={field} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Observações da matriz</label>
          <textarea rows={2} value={o.adminNotes} onChange={(e) => setO({ ...o, adminNotes: e.target.value })} className={field}
            placeholder="Ex.: razão do desconto ou do extra; data programada do envio" />
        </div>
      </div>

      <p className="text-sm text-gray-700">Valor total: <strong>{brl(totals.total)}</strong>{o.dryIce && totals.dryIce > 0 ? ` (gelo seco ${brl(totals.dryIce)})` : ""}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => act("save")} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
          {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
        </button>
        {order.status === "WAITING" && (
          <button onClick={() => act("invoice")} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-blue-600 text-white disabled:opacity-50">
            {busy === "invoice" ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />} Marcar como faturado
          </button>
        )}
        {confirm === "ship" ? (
          <>
            <span className="text-sm text-gray-700">Confirmar o envio? Os itens entram no estoque da unidade.</span>
            <button onClick={() => act("ship")} disabled={!!busy} className="px-4 py-2 rounded-lg text-sm bg-primary text-white disabled:opacity-50">
              {busy === "ship" ? <Loader2 size={16} className="animate-spin" /> : "Sim, enviar"}
            </button>
            <button onClick={() => setConfirm("")} className="px-3 py-2 rounded-lg text-sm border border-gray-200">Voltar</button>
          </>
        ) : (
          <button onClick={() => setConfirm("ship")} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-primary text-white disabled:opacity-50">
            <Truck size={16} /> Marcar como enviado
          </button>
        )}
        {confirm === "cancel" ? (
          <>
            <span className="text-sm text-gray-700">Cancelar o pedido?</span>
            <button onClick={() => act("cancel")} disabled={!!busy} className="px-3 py-2 rounded-lg text-sm bg-red-600 text-white disabled:opacity-50">Sim, cancelar</button>
            <button onClick={() => setConfirm("")} className="px-3 py-2 rounded-lg text-sm border border-gray-200">Não</button>
          </>
        ) : (
          <button onClick={() => setConfirm("cancel")} disabled={!!busy} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-600">
            <XCircle size={16} /> Cancelar pedido
          </button>
        )}
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
        {ok && <p className="w-full text-sm text-green-600">{ok}</p>}
      </div>
    </div>
  );
}
