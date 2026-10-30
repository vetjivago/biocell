"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2, MapPin, Phone, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { SPECIES } from "@/lib/species";
import { formatCep, formatCnpj, formatPhoneInput, isValidCnpj, LEGAL_CATEGORIES, onlyDigits, STATES } from "@/lib/units";

export interface UnitFormData {
  id?: string;
  name: string;
  city: string;
  state: string;
  // Endereço antigo (texto livre), mantido enquanto os campos novos estiverem vazios
  address: string;
  species: string[];
  generalRecordEnabled: boolean;
  serviceOrderEnabled: boolean;
  active: boolean;
  cnpj: string;
  legalName: string;
  tradeName: string;
  legalNature: string;
  legalCategory: string;
  stateRegistration: string;
  shareCapital: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  phones: string[];
  mobiles: string[];
  emails: string[];
  billingEmails: string[];
  financeEmails: string[];
}

type ListKey = "phones" | "mobiles" | "emails" | "billingEmails" | "financeEmails";

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600";
const label = "block text-sm font-medium text-gray-700 mb-1";
const card = "bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4";
const title = "flex items-center gap-2 text-base font-semibold text-gray-900";

export default function UnitForm({ initial, readOnly = false }: { initial: UnitFormData; readOnly?: boolean }) {
  const router = useRouter();
  const isEdit = !!initial.id;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [lookup, setLookup] = useState<"" | "cnpj" | "cep">("");
  const [lookupMsg, setLookupMsg] = useState("");
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const set = <K extends keyof UnitFormData>(k: K, v: UnitFormData[K]) => setForm((f) => ({ ...f, [k]: v }));
  const cnpjDigits = onlyDigits(form.cnpj);
  const cnpjInvalid = cnpjDigits.length === 14 && !isValidCnpj(cnpjDigits);

  function toggleSpecies(s: string) {
    setForm((f) => ({ ...f, species: f.species.includes(s) ? f.species.filter((x) => x !== s) : [...f.species, s] }));
  }

  // Busca na Receita (BrasilAPI) ou nos Correios (ViaCEP). O CNPJ só preenche os campos vazios (o endereço
  // na Receita pode ser o da matriz da empresa, não o da unidade); o CEP troca o endereço
  async function fetchLookup(kind: "cnpj" | "cep") {
    setLookup(kind);
    setLookupMsg("");
    const res = await fetch(`/api/units/lookup?${kind}=${kind === "cnpj" ? cnpjDigits : onlyDigits(form.zipCode)}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setLookup("");
    if (!res?.ok || !data) return setLookupMsg(data?.error || "Consulta indisponível agora; preencha manualmente");
    setForm((f) => {
      const next = { ...f };
      for (const k of ["legalName", "tradeName", "legalNature", "legalCategory", "shareCapital", "street", "number", "complement", "district", "city"] as const) {
        if (data[k] && (kind === "cep" || !f[k])) next[k] = data[k];
      }
      if (data.zipCode && !onlyDigits(f.zipCode)) next.zipCode = formatCep(data.zipCode);
      if ((STATES as readonly string[]).includes(data.state) && (kind === "cep" || !f.state)) next.state = data.state;
      if (data.phones?.length && !f.phones.some(Boolean)) next.phones = data.phones;
      if (data.mobiles?.length && !f.mobiles.some(Boolean)) next.mobiles = data.mobiles;
      if (data.email && !f.emails.includes(data.email)) next.emails = [...f.emails.filter(Boolean), data.email];
      return next;
    });
    if (kind === "cnpj") setLookupMsg(`Dados da Receita preenchidos${data.status ? ` (situação: ${data.status})` : ""}. Confira antes de salvar.`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cnpjInvalid) return setError("CNPJ inválido (confira os dígitos)");
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
      <div className={card}>
        <p className="text-sm text-gray-700"><strong>{created.name}</strong> cadastrada. O estoque dela começa zerado: abasteça pela tela de Estoque.</p>
        <p className="text-sm text-gray-500">Agora crie o acesso do responsável pela unidade. Os documentos (Cartão CNPJ, contratos) são anexados na ficha da unidade.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/usuarios/novo?unidade=${created.id}`} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <UserPlus size={16} /> Criar acesso para esta unidade
          </Link>
          <button type="button" onClick={() => router.push(`/unidades/${created.id}`)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Abrir ficha da unidade</button>
        </div>
      </div>
    );
  }

  const listField = (k: ListKey, lbl: string, kind: "tel" | "email", hint?: string) => {
    const values = form[k].length ? form[k] : [""];
    const update = (i: number, v: string) => set(k, values.map((x, j) => (j === i ? (kind === "tel" ? formatPhoneInput(v) : v) : x)));
    return (
      <div>
        <p className={label}>{lbl}{hint && <span className="font-normal text-gray-400"> {hint}</span>}</p>
        <div className="space-y-2">
          {values.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input type={kind} value={v} onChange={(e) => update(i, e.target.value)} className={input}
                placeholder={kind === "tel" ? (k === "mobiles" ? "(00) 00000-0000" : "(00) 0000-0000") : "nome@empresa.com.br"} />
              {!readOnly && values.length > 1 && (
                <button type="button" onClick={() => set(k, values.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600" aria-label="Remover">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <button type="button" onClick={() => set(k, [...values, ""])} className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus size={14} /> Adicionar
          </button>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <section className={card}>
            <h2 className={title}><Building2 size={18} className="text-gray-400" /> Informações básicas</h2>
            <div>
              <label className={label}>Nome da unidade *</label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="UABC NOME DA CLÍNICA" className={`${input} uppercase`} />
            </div>
            <div>
              <label className={label}>CNPJ</label>
              <div className="flex gap-2">
                <input value={formatCnpj(form.cnpj)} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric"
                  className={`${input} ${cnpjInvalid ? "border-red-400" : ""}`} />
                {!readOnly && (
                  <button type="button" onClick={() => fetchLookup("cnpj")} disabled={cnpjDigits.length !== 14 || cnpjInvalid || !!lookup}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-40" title="Preencher com os dados da Receita Federal">
                    {lookup === "cnpj" ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar
                  </button>
                )}
              </div>
              {cnpjInvalid && <p className="text-xs text-red-600 mt-1">CNPJ inválido (confira os dígitos)</p>}
            </div>
            <div><label className={label}>Razão social</label><input value={form.legalName} onChange={(e) => set("legalName", e.target.value)} className={input} /></div>
            <div><label className={label}>Nome fantasia</label><input value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} className={input} /></div>
            <div><label className={label}>Natureza jurídica</label><input value={form.legalNature} onChange={(e) => set("legalNature", e.target.value)} placeholder="206-2 - Sociedade Empresária Limitada" className={input} /></div>
            <div>
              <label className={label}>Categoria jurídica</label>
              <select value={form.legalCategory} onChange={(e) => set("legalCategory", e.target.value)} className={input}>
                <option value="">Selecione a categoria jurídica</option>
                {LEGAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={label}>Inscrição estadual</label><input value={form.stateRegistration} onChange={(e) => set("stateRegistration", e.target.value)} placeholder="Isento, se não tiver" className={input} /></div>
              <div><label className={label}>Capital social (R$)</label><input value={form.shareCapital} onChange={(e) => set("shareCapital", e.target.value)} placeholder="0,00" inputMode="decimal" className={input} /></div>
            </div>
          </section>

          <div className="space-y-4">
            <section className={card}>
              <h2 className={title}><MapPin size={18} className="text-gray-400" /> Endereço</h2>
              <div>
                <label className={label}>CEP</label>
                <div className="flex gap-2">
                  <input value={formatCep(form.zipCode)} onChange={(e) => set("zipCode", e.target.value)} placeholder="00.000-000" inputMode="numeric" className={`${input} max-w-44`} />
                  {!readOnly && (
                    <button type="button" onClick={() => fetchLookup("cep")} disabled={onlyDigits(form.zipCode).length !== 8 || !!lookup}
                      className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-40">
                      {lookup === "cep" ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar CEP
                    </button>
                  )}
                  {!readOnly && form.zipCode && (
                    <button type="button" onClick={() => setForm((f) => ({ ...f, zipCode: "", street: "", number: "", complement: "", district: "" }))}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
                      <Trash2 size={14} /> Limpar
                    </button>
                  )}
                </div>
              </div>
              {lookupMsg && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{lookupMsg}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3"><label className={label}>Logradouro</label><input value={form.street} onChange={(e) => set("street", e.target.value)} className={input} /></div>
                <div><label className={label}>Número</label><input value={form.number} onChange={(e) => set("number", e.target.value)} className={input} /></div>
                <div className="sm:col-span-3"><label className={label}>Bairro</label><input value={form.district} onChange={(e) => set("district", e.target.value)} className={input} /></div>
                <div><label className={label}>Complemento</label><input value={form.complement} onChange={(e) => set("complement", e.target.value)} className={input} /></div>
                <div className="sm:col-span-3"><label className={label}>Cidade *</label><input required value={form.city} onChange={(e) => set("city", e.target.value)} className={input} /></div>
                <div>
                  <label className={label}>Estado *</label>
                  <select required value={form.state} onChange={(e) => set("state", e.target.value)} className={input}>
                    <option value="">UF</option>
                    {STATES.map((s) => <option key={s} value={s}>{s === "EXT" ? "Internacional" : s}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className={card}>
              <h2 className={title}><Phone size={18} className="text-gray-400" /> Contato</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {listField("phones", "Telefones", "tel")}
                {listField("mobiles", "Celulares", "tel")}
              </div>
              {listField("emails", "E-mails", "email")}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-amber-50/60 border border-amber-100 p-3">
                {listField("billingEmails", "E-mails de faturamento", "email", "(NF e boletos)")}
                {listField("financeEmails", "E-mails do financeiro", "email")}
              </div>
            </section>
          </div>
        </div>

        <section className={card}>
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
        </section>
      </fieldset>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {saved && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">Alterações salvas.</div>}

      {!readOnly && (
        <button type="submit" disabled={saving}
          className="w-full bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar unidade"}
        </button>
      )}
    </form>
  );
}
