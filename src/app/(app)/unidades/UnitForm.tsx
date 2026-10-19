"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { SPECIES } from "@/lib/species";
import { STATES } from "@/lib/units";

interface Initial {
  id?: string;
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  species: string[];
  generalRecordEnabled: boolean;
  serviceOrderEnabled: boolean;
  active: boolean;
}

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-sm font-medium text-gray-700 mb-1";

export default function UnitForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const isEdit = !!initial.id;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setForm((f) => ({ ...f, [k]: v }));

  function toggleSpecies(s: string) {
    setForm((f) => ({ ...f, species: f.species.includes(s) ? f.species.filter((x) => x !== s) : [...f.species, s] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch(isEdit ? `/api/units/${initial.id}` : "/api/units", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "Erro ao salvar");
    if (!isEdit) return setCreated({ id: data.id, name: data.name });
    setSaved(true);
    router.refresh();
  }

  if (created) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <p className="text-sm text-gray-700"><strong>{created.name}</strong> cadastrada. O estoque dela começa zerado: abasteça pela tela de Estoque.</p>
        <p className="text-sm text-gray-500">Agora crie o acesso do responsável pela unidade.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/usuarios/novo?unidade=${created.id}`} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <UserPlus size={16} /> Criar acesso para esta unidade
          </Link>
          <button type="button" onClick={() => router.push("/unidades")} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Voltar para as unidades</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
      <div>
        <label className={label}>Nome da unidade *</label>
        <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="UABC NOME DA CLÍNICA" className={`${input} uppercase`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2"><label className={label}>Cidade *</label><input required value={form.city} onChange={(e) => set("city", e.target.value)} className={input} /></div>
        <div>
          <label className={label}>Estado *</label>
          <select required value={form.state} onChange={(e) => set("state", e.target.value)} className={input}>
            <option value="">Selecione</option>
            {STATES.map((s) => <option key={s} value={s}>{s === "EXT" ? "Internacional" : s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2"><label className={label}>Endereço</label><input value={form.address} onChange={(e) => set("address", e.target.value)} className={input} /></div>
        <div><label className={label}>Telefone</label><input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" className={input} /></div>
      </div>

      <div>
        <p className={label}>Espécies atendidas *</p>
        <div className="flex flex-wrap gap-2">
          {SPECIES.map((s) => (
            <label key={s} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.species.includes(s) ? "border-primary bg-primary/5" : "border-gray-200"}`}>
              <input type="checkbox" checked={form.species.includes(s)} onChange={() => toggleSpecies(s)} className="rounded border-gray-300" />
              {s}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className={label}>Módulos liberados</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={form.generalRecordEnabled} onChange={(e) => set("generalRecordEnabled", e.target.checked)} className="mt-0.5 rounded border-gray-300" />
          <span>Prontuário clínico geral <span className="text-gray-400">(para unidades que não usam outro sistema, como o SimplesVet)</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={form.serviceOrderEnabled} onChange={(e) => set("serviceOrderEnabled", e.target.checked)} className="mt-0.5 rounded border-gray-300" />
          <span>Ordem de Serviço para o preparo das células</span>
        </label>
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="rounded border-gray-300" />
          Unidade ativa <span className="text-gray-400">(desmarque para tirar das listas; o histórico é mantido)</span>
        </label>
      )}

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {saved && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">Alterações salvas.</div>}

      <button type="submit" disabled={saving}
        className="w-full bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
        {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar unidade"}
      </button>
    </form>
  );
}
