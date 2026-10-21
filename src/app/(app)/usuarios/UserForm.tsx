"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { ROLES, roleFlags, roleFromFlags, type Role } from "@/lib/roles";
import { formatPhone, normalizePhone } from "@/lib/phone";

const TEAM_ROLES: Role[] = ["PROFESSIONAL", "LAB", "PROFESSIONAL_LAB"];

interface Unit { id: string; name: string; city: string; state: string }
interface Initial { id?: string; name: string; email: string; phone: string; role: Role; unitIds: string[]; active: boolean }

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-sm font-medium text-gray-700 mb-1";

// Senha provisória mostrada uma única vez, com botão de copiar
export function TempPasswordBox({ email, phone, password }: { email: string; phone: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const login = [email && `E-mail: ${email}`, phone && `Celular: ${formatPhone(normalizePhone(phone)) || phone}`].filter(Boolean).join("\n");
  const text = `Acesso BIO CELL\nEndereço: ${typeof window !== "undefined" ? window.location.origin : ""}\nEntre com o ${email && phone ? "e-mail ou o celular" : email ? "e-mail" : "celular"}:\n${login}\nSenha provisória: ${password}\n(no primeiro acesso o sistema pede para criar uma senha pessoal)`;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-2">
      <p className="font-semibold text-amber-900 flex items-center gap-2"><KeyRound size={16} /> Senha provisória (anote ou copie agora — ela não aparece de novo)</p>
      <p className="font-mono text-lg tracking-wider text-gray-900 select-all">{password}</p>
      <button type="button"
        onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-amber-900 hover:bg-amber-100">
        <Copy size={14} /> {copied ? "Copiado!" : "Copiar mensagem para enviar à pessoa"}
      </button>
    </div>
  );
}

export default function UserForm({
  initial, units, roles, isSelf = false,
}: {
  initial: Initial;
  units: Unit[];
  roles: Role[];
  isSelf?: boolean;
}) {
  const router = useRouter();
  const isEdit = !!initial.id;
  const [form, setForm] = useState(initial);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);

  const visibleUnits = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? units.filter((u) => `${u.name} ${u.city} ${u.state}`.toLowerCase().includes(q)) : units;
  }, [units, filter]);
  const needsUnits = form.role !== "ADMIN";
  const flags = roleFlags(form.role);

  // Desmarcar a única caixa marcada não deixa a pessoa sem função
  function toggleTeamRole(k: "clinical" | "lab") {
    const next = { ...flags, [k]: !flags[k] };
    const role = roleFromFlags(next.clinical, next.lab);
    if (role) setForm((f) => ({ ...f, role }));
  }

  function toggleUnit(id: string) {
    setForm((f) => ({ ...f, unitIds: f.unitIds.includes(id) ? f.unitIds.filter((u) => u !== id) : [...f.unitIds, id] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch(isEdit ? `/api/users/${initial.id}` : "/api/users", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        unitIds: needsUnits ? form.unitIds : [],
        ...(isEdit ? { active: form.active } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "Erro ao salvar");
    if (!isEdit) {
      setTemp(data.tempPassword);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function deleteUser() {
    if (!confirm(`Excluir o acesso de ${initial.name}? A pessoa não consegue mais entrar e sai da lista de usuários. Prontuários e atendimentos que ela registrou continuam no histórico.`)) return;
    setError("");
    const res = await fetch(`/api/users/${initial.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "Erro ao excluir");
    router.push("/usuarios");
    router.refresh();
  }

  async function resetPassword() {
    if (!confirm(`Gerar uma nova senha provisória para ${initial.name}? A senha atual deixa de funcionar.`)) return;
    setError("");
    const res = await fetch(`/api/users/${initial.id}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "Erro ao redefinir");
    setTemp(data.tempPassword);
  }

  if (temp && !isEdit) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <p className="text-sm text-gray-700">Acesso criado para <strong>{form.name}</strong> ({[form.email, form.phone].filter(Boolean).join(" · ")}).</p>
        <TempPasswordBox email={form.email} phone={form.phone} password={temp} />
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push("/usuarios")} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">Voltar para a lista</button>
          <button type="button" onClick={() => { setTemp(null); setForm({ ...initial }); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Criar outro acesso</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={label}>Nome *</label><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} /></div>
        <div>
          <label className={label}>Celular (login)</label>
          <input type="tel" inputMode="tel" value={form.phone} placeholder="(61) 99999-8888"
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            onBlur={() => setForm((f) => ({ ...f, phone: formatPhone(normalizePhone(f.phone)) || f.phone }))}
            className={input} />
        </div>
        <div>
          <label className={label}>E-mail (login)</label>
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={input} />
        </div>
        <p className="sm:col-span-2 -mt-2 text-xs text-gray-400">Preencha o celular, o e-mail ou os dois: a pessoa entra com qualquer um deles e a senha.</p>
      </div>

      <div>
        <p className={label}>Função *</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {roles.filter((r) => !TEAM_ROLES.includes(r)).map((r) => (
            <label key={r} className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${form.role === r ? "border-primary bg-primary/5" : "border-gray-200"} ${isSelf ? "opacity-60 cursor-not-allowed" : ""}`}>
              <input type="radio" name="role" checked={form.role === r} disabled={isSelf} onChange={() => setForm((f) => ({ ...f, role: r }))} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-gray-900">{ROLES[r].label}</span>
                <span className="block text-xs text-gray-500">{ROLES[r].description}</span>
              </span>
            </label>
          ))}
          {/* Clínico e laboratório: marque um ou os dois */}
          {(["clinical", "lab"] as const).map((k) => {
            const r: Role = k === "clinical" ? "PROFESSIONAL" : "LAB";
            if (!roles.includes(r)) return null;
            return (
              <label key={r} className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${flags[k] ? "border-primary bg-primary/5" : "border-gray-200"} ${isSelf ? "opacity-60 cursor-not-allowed" : ""}`}>
                <input type="checkbox" checked={flags[k]} disabled={isSelf} onChange={() => toggleTeamRole(k)} className="mt-0.5 rounded border-gray-300" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{ROLES[r].label}</span>
                  <span className="block text-xs text-gray-500">{ROLES[r].description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {flags.clinical && flags.lab && (
          <p className="text-xs text-gray-500 mt-1">Esta pessoa terá os dois acessos: veterinário clínico e laboratório.</p>
        )}
      </div>

      {needsUnits && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className={label}>Unidades * <span className="font-normal text-gray-400">({form.unitIds.length} selecionada{form.unitIds.length === 1 ? "" : "s"})</span></p>
          </div>
          {units.length > 8 && (
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar unidade ou cidade..." className={`${input} mb-2`} />
          )}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {visibleUnits.map((u) => (
              <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form.unitIds.includes(u.id)} onChange={() => toggleUnit(u.id)} className="rounded border-gray-300" />
                <span className="flex-1">{u.name}</span>
                <span className="text-xs text-gray-400">{u.city}/{u.state}</span>
              </label>
            ))}
            {visibleUnits.length === 0 && <p className="px-3 py-4 text-sm text-gray-400">Nenhuma unidade encontrada</p>}
          </div>
          <p className="text-xs text-gray-400 mt-1">Todos da mesma unidade veem os mesmos pacientes, prontuários e Ordens de Serviço.</p>
        </div>
      )}

      {isEdit && !isSelf && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded border-gray-300" />
          Acesso ativo <span className="text-gray-400">(desmarque para bloquear o login na hora)</span>
        </label>
      )}

      {temp && isEdit && <TempPasswordBox email={form.email} phone={form.phone} password={temp} />}
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {saved && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">Alterações salvas.</div>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar acesso"}
        </button>
        {isEdit && !isSelf && (
          <button type="button" onClick={resetPassword}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <KeyRound size={14} /> Gerar nova senha provisória
          </button>
        )}
        {isEdit && !isSelf && (
          <button type="button" onClick={deleteUser}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Excluir usuário
          </button>
        )}
      </div>
    </form>
  );
}
