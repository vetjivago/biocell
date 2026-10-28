"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Copy, FileText, Mail, Pencil, Printer, RotateCcw, Shuffle, Trash2, Wallet } from "lucide-react";
import { MAX_INSTALLMENTS, PAYMENT_METHODS, formatBRL } from "@/lib/sales-types";

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-xs font-medium text-gray-500 mb-1";
const btn = "flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro ao salvar");
  return data;
}

export default function SaleActions({
  sale, canManage, financeDoc, mail,
}: {
  sale: {
    id: string; patientId: string; status: string; isSale: boolean;
    paymentMethod: string; installments: number; paymentNotes: string; soldAt: string; notes: string; total: number;
  };
  canManage: boolean;
  financeDoc: boolean;
  mail: { subject: string; body: string };
}) {
  const router = useRouter();
  const base = `/pacientes/${sale.patientId}/orcamentos/${sale.id}`;
  // "convert": converter em venda; "payment": corrigir pagamento/observações de uma venda
  const [panel, setPanel] = useState<"convert" | "payment" | null>(null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [form, setForm] = useState({
    paymentMethod: sale.paymentMethod || "Pix",
    installments: sale.installments,
    paymentNotes: sale.paymentNotes,
    soldAt: sale.soldAt || today,
    notes: sale.notes,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: field === "installments" ? Number(e.target.value) : e.target.value }));
  const parcelable = form.paymentMethod === "Cartão de crédito" || form.paymentMethod === "Boleto";

  async function run(fn: () => Promise<unknown>, after?: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setPanel(null);
      if (after) router.push(after);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  const action = (name: string, question: string, after?: string) => () => {
    if (confirm(question)) run(() => send(`/api/sales/${sale.id}`, "PATCH", { action: name }), after);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${mail.subject}\n\n${mail.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar");
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;

  return (
    <div className="mb-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {sale.status === "QUOTE" && (
          <>
            <Link href={`${base}/editar`} className={btn}><Pencil size={14} /> Editar</Link>
            <button type="button" onClick={() => setPanel(panel === "convert" ? null : "convert")}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              <Shuffle size={14} /> Converter em venda
            </button>
          </>
        )}
        {sale.status === "SALE" && (
          <button type="button" onClick={() => setPanel(panel === "payment" ? null : "payment")} className={btn}>
            <Wallet size={14} /> Pagamento e observações
          </button>
        )}
        <button type="button" onClick={() => window.print()} className={btn}>
          <Printer size={14} /> {financeDoc ? "Imprimir / PDF p/ financeiro" : "Imprimir / PDF"}
        </button>
        {sale.isSale && (
          <Link href={financeDoc ? `${base}?doc=orcamento` : base} className={btn}>
            <FileText size={14} /> {financeDoc ? "Ver como orçamento" : "Ver documento do financeiro"}
          </Link>
        )}
        <a href={mailto} className={btn}><Mail size={14} /> {sale.isSale ? "Enviar ao financeiro" : "Enviar por e-mail"}</a>
        <button type="button" onClick={copy} className={btn}><Copy size={14} /> {copied ? "Copiado!" : "Copiar texto"}</button>

        {canManage && (
          <span className="flex flex-wrap gap-2 sm:ml-auto">
            {sale.status === "SALE" && (
              <button type="button" disabled={busy} onClick={action("revert", "Desfazer a venda? Ela volta a ser um orçamento e a forma de pagamento é apagada.")} className={btn}>
                <RotateCcw size={14} /> Desfazer venda
              </button>
            )}
            {sale.status !== "CANCELLED" ? (
              <button type="button" disabled={busy} onClick={action("cancel", sale.isSale ? "Cancelar esta venda?" : "Cancelar este orçamento?")}
                className={`${btn} text-red-600`}>
                <Ban size={14} /> Cancelar
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={action("reopen", "Reabrir?")} className={btn}>
                <RotateCcw size={14} /> Reabrir
              </button>
            )}
            {sale.status !== "SALE" && (
              <button type="button" disabled={busy} aria-label="Apagar"
                onClick={() => {
                  if (confirm("Apagar definitivamente? Esta ação não pode ser desfeita.")) {
                    run(() => send(`/api/sales/${sale.id}`, "DELETE"), `/pacientes/${sale.patientId}?aba=financeiro`);
                  }
                }}
                className={`${btn} text-red-600`}>
                <Trash2 size={14} />
              </button>
            )}
          </span>
        )}
      </div>

      {panel && (
        <div className="mt-3 p-4 bg-white border border-gray-200 rounded-xl space-y-3">
          <p className="font-semibold text-gray-900">
            {panel === "convert" ? `Converter em venda · ${formatBRL(sale.total)}` : "Pagamento e observações"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Forma de pagamento</label>
              <select value={form.paymentMethod} onChange={set("paymentMethod")} className={input}>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            {parcelable && (
              <div>
                <label className={label}>Parcelas</label>
                <select value={form.installments} onChange={set("installments")} className={input}>
                  {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x de ${formatBRL(Math.round(sale.total / n))}`}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={label}>Data da venda</label>
              <input type="date" value={form.soldAt} onChange={set("soldAt")} className={input} />
            </div>
            <div className="sm:col-span-3">
              <label className={label}>Observações do pagamento</label>
              <textarea value={form.paymentNotes} onChange={set("paymentNotes")} rows={2} className={input}
                placeholder="Ex: entrada de R$ 300,00 no Pix e o restante no cartão; NF em nome do tutor" />
            </div>
            {panel === "payment" && (
              <div className="sm:col-span-3">
                <label className={label}>Observações gerais</label>
                <textarea value={form.notes} onChange={set("notes")} rows={3} className={input} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPanel(null)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">Voltar</button>
            <button type="button" disabled={busy}
              onClick={() => run(() => send(`/api/sales/${sale.id}`, "PATCH", {
                action: panel === "convert" ? "convert" : "update",
                paymentMethod: form.paymentMethod,
                installments: parcelable ? form.installments : null,
                paymentNotes: form.paymentNotes,
                soldAt: form.soldAt,
                ...(panel === "payment" ? { notes: form.notes } : {}),
              }), panel === "convert" ? base : undefined)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {busy ? "Salvando..." : panel === "convert" ? "Confirmar venda" : "Salvar"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
