"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PATHOLOGIES } from "@/lib/pathologies";
import { normalizeSpecies } from "@/lib/species";
import { PRODUCT_CATEGORIES, lotLabel, type ProductCategory } from "@/lib/products";

type Category = ProductCategory;
interface Item { batchId: string; category: Category; quantity: string }
interface App { id?: string; number: number; date: string; items: Item[]; summary?: string }
interface Thaw { number: number; thawedStraws: string; thawedMeio: string; thawedSoro: string; retrievalLocation: string }
export interface StockLot { batchId: string; batchNumber: string; productName: string; category: string; species: string | null; balance: number }

export interface EditRecordInitial {
  id: string;
  lotsEditable: boolean;
  patientSpecies: string;
  pathology: string;
  cellQuantity: string;
  applicationRoute: string;
  donors: string;
  serumCollected: boolean;
  applications: App[];
  thawings: Thaw[];
}

const CATS = PRODUCT_CATEGORIES;
const OTHER = "__OTHER__";
const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-sm font-medium text-gray-700 mb-1";

export default function EditRecordForm({ initial, stock }: { initial: EditRecordInitial; stock: StockLot[] }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pathologyChoice, setPathologyChoice] = useState(PATHOLOGIES.includes(initial.pathology) ? initial.pathology : OTHER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editable = initial.lotsEditable;

  const set = <K extends keyof EditRecordInitial>(k: K, v: EditRecordInitial[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setApps = (fn: (apps: App[]) => App[]) => setForm((f) => ({ ...f, applications: fn(f.applications) }));
  const setThaws = (fn: (t: Thaw[]) => Thaw[]) => setForm((f) => ({ ...f, thawings: fn(f.thawings) }));

  // Células e soro só da espécie do paciente (lotes sem espécie identificável continuam aparecendo)
  const lotsFor = (cat: Category) => stock.filter((l) => {
    if (l.category !== cat) return false;
    if (cat !== "CELULAS" && cat !== "SORO") return true;
    const kind = normalizeSpecies(l.species) || normalizeSpecies(l.productName);
    return !kind || kind === normalizeSpecies(form.patientSpecies);
  });
  const remaining = (batchId: string, ai: number, ii: number) => {
    const lot = stock.find((l) => l.batchId === batchId);
    if (!lot) return 0;
    const used = form.applications.reduce((s, a, x) => s + a.items.reduce((s2, it, y) =>
      s2 + (it.batchId === batchId && !(x === ai && y === ii) ? parseInt(it.quantity) || 0 : 0), 0), 0);
    return lot.balance - used;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pathology = pathologyChoice === OTHER ? form.pathology.trim() : pathologyChoice;
    if (!pathology) return setError("Informe a patologia");
    for (const [ai, a] of form.applications.entries()) {
      if (a.items.some((it) => !!it.batchId !== (parseInt(it.quantity) > 0))) {
        return setError(`${a.number}ª aplicação: informe lote e quantidade em cada linha (ou remova a linha)`);
      }
      if (editable && a.items.some((it, ii) => it.batchId && parseInt(it.quantity) > remaining(it.batchId, ai, ii))) {
        return setError(`${a.number}ª aplicação: quantidade acima do disponível no lote`);
      }
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/medical-records/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pathology,
        cellQuantity: form.cellQuantity,
        applicationRoute: form.applicationRoute,
        donors: form.donors,
        serumCollected: form.serumCollected,
        applications: form.applications.map((a) => ({
          id: a.id, number: a.number, date: a.date || null,
          items: a.items.filter((it) => it.batchId).map((it) => ({ batchId: it.batchId, category: it.category, quantity: parseInt(it.quantity) })),
        })),
        thawings: form.thawings,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Erro ao salvar");
      setSaving(false);
      return;
    }
    router.push(`/prontuarios/${initial.id}`);
    router.refresh();
  }

  const maxApp = Math.max(0, ...form.applications.map((a) => a.number));
  const maxThaw = Math.max(0, ...form.thawings.map((t) => t.number));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!editable && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm">
          Este prontuário já deu baixa no estoque: os lotes e quantidades não podem ser alterados. Os demais dados podem ser corrigidos.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Protocolo de Tratamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>Patologia *</label>
            <select value={pathologyChoice} onChange={(e) => setPathologyChoice(e.target.value)} className={input}>
              {PATHOLOGIES.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value={OTHER}>Outra (especificar)</option>
            </select>
            {pathologyChoice === OTHER && (
              <input required value={form.pathology} onChange={(e) => set("pathology", e.target.value)} className={`${input} mt-2`} placeholder="Descreva a patologia" />
            )}
          </div>
          <div><label className={label}>Quantidade de células</label><input value={form.cellQuantity} onChange={(e) => set("cellQuantity", e.target.value)} className={input} /></div>
          <div><label className={label}>Vias de aplicação</label><input value={form.applicationRoute} onChange={(e) => set("applicationRoute", e.target.value)} className={input} /></div>
          <div><label className={label}>Doadores</label><input value={form.donors} onChange={(e) => set("donors", e.target.value)} className={input} /></div>
          <label className="flex items-center gap-2 pt-6 text-sm text-gray-700">
            <input type="checkbox" checked={form.serumCollected} onChange={(e) => set("serumCollected", e.target.checked)} className="rounded border-gray-300" />
            Soro coletado
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Aplicações</h2>
          {editable && form.applications.length < 6 && (
            <button type="button" className="text-sm text-primary hover:underline"
              onClick={() => setApps((apps) => [...apps, { number: maxApp + 1, date: "", items: CATS.filter((c) => c.key !== "MATERIAL").map((c) => ({ category: c.key, batchId: "", quantity: "" })) }])}>
              + Adicionar aplicação
            </button>
          )}
        </div>
        {form.applications.length === 0 && <p className="text-sm text-gray-400">Nenhuma aplicação registrada.</p>}
        {form.applications.map((a, ai) => (
          <div key={a.id ?? `new-${a.number}`} className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-700">{a.number}ª Aplicação</p>
              {editable && (
                <button type="button" onClick={() => setApps((apps) => apps.filter((_, j) => j !== ai))} className="text-xs text-gray-400 hover:text-red-500">Remover aplicação</button>
              )}
            </div>
            <div className="sm:w-1/2">
              <label className="block text-xs text-gray-500 mb-1">Data</label>
              <input type="date" value={a.date} onChange={(e) => setApps((apps) => apps.map((x, j) => (j === ai ? { ...x, date: e.target.value } : x)))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
            </div>
            {!editable ? (
              <p className="text-sm text-gray-600">{a.summary || "Sem lotes registrados"}</p>
            ) : CATS.map((c) => {
              const lots = lotsFor(c.key);
              const rows = a.items.map((it, ii) => ({ it, ii })).filter(({ it }) => it.category === c.key);
              return (
                <div key={c.key} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{c.label}</p>
                    {lots.length > 0 && (
                      <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() => setApps((apps) => apps.map((x, j) => (j === ai ? { ...x, items: [...x.items, { category: c.key, batchId: "", quantity: "" }] } : x)))}>
                        <Plus size={12} /> {c.key === "MATERIAL" ? "Adicionar material" : rows.length ? "Outro lote" : "Adicionar lote"}
                      </button>
                    )}
                  </div>
                  {lots.length === 0 && rows.length === 0 && <p className="text-xs text-amber-600">Nenhum lote de {c.label.toLowerCase()} no estoque da unidade.</p>}
                  {rows.map(({ it, ii }) => {
                    const max = it.batchId ? remaining(it.batchId, ai, ii) : 0;
                    const over = !!it.batchId && (parseInt(it.quantity) || 0) > max;
                    const used = rows.filter((r) => r.ii !== ii).map((r) => r.it.batchId);
                    const update = (patch: Partial<Item>) => setApps((apps) => apps.map((x, j) => (j !== ai ? x : { ...x, items: x.items.map((y, k) => (k === ii ? { ...y, ...patch } : y)) })));
                    return (
                      <div key={ii} className="flex flex-wrap sm:flex-nowrap gap-2 items-start">
                        <select value={it.batchId} onChange={(e) => update({ batchId: e.target.value })} aria-label={`Lote de ${c.label.toLowerCase()}`}
                          className="w-full sm:w-auto sm:flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded text-sm bg-white">
                          <option value="">Selecione o lote...</option>
                          {lots.filter((l) => l.batchId === it.batchId || !used.includes(l.batchId)).map((l) => (
                            <option key={l.batchId} value={l.batchId}>{lotLabel(l.batchNumber, l.productName)} ({remaining(l.batchId, ai, ii)} disp.)</option>
                          ))}
                        </select>
                        <div className="flex-1 sm:flex-none sm:w-24">
                          <input type="number" min="1" value={it.quantity} onChange={(e) => update({ quantity: e.target.value })} placeholder={c.unit}
                            className={`w-full px-2 py-2 border rounded text-sm ${over ? "border-red-400" : "border-gray-300"}`} aria-label={`Quantidade de ${c.label.toLowerCase()}`} />
                          {over && <p className="text-[11px] text-red-500 mt-0.5">Máx. {max}</p>}
                        </div>
                        <button type="button" aria-label="Remover lote" className="p-2 text-gray-400 hover:text-red-500"
                          onClick={() => setApps((apps) => apps.map((x, j) => (j !== ai ? x : { ...x, items: x.items.filter((_, k) => k !== ii) })))}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Procedimento Inicial (Descongelamento)</h2>
          {form.thawings.length < 6 && (
            <button type="button" className="text-sm text-primary hover:underline"
              onClick={() => setThaws((t) => [...t, { number: maxThaw + 1, thawedStraws: "", thawedMeio: "", thawedSoro: "", retrievalLocation: "" }])}>
              + Adicionar
            </button>
          )}
        </div>
        {form.thawings.length === 0 && <p className="text-sm text-gray-400">Nenhum descongelamento registrado.</p>}
        {form.thawings.map((t, ti) => {
          const upd = (k: keyof Thaw, v: string) => setThaws((list) => list.map((x, j) => (j === ti ? { ...x, [k]: v } : x)));
          return (
            <div key={ti} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{t.number}º Descongelamento</p>
                <button type="button" onClick={() => setThaws((list) => list.filter((_, j) => j !== ti))} className="text-xs text-gray-400 hover:text-red-500">Remover</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Palhetas</label><input type="number" min="0" value={t.thawedStraws} onChange={(e) => upd("thawedStraws", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Meio</label><input type="number" min="0" value={t.thawedMeio} onChange={(e) => upd("thawedMeio", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Soro</label><input type="number" min="0" value={t.thawedSoro} onChange={(e) => upd("thawedSoro", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Local de retirada</label><input value={t.retrievalLocation} onChange={(e) => upd("retrievalLocation", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={saving}
          className="flex-1 bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
