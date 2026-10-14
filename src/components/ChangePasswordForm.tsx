"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const input = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm";

export default function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.newPassword !== form.confirm) return setError("A confirmação não confere com a nova senha");
    setLoading(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error || "Erro ao trocar a senha");
    setForm({ currentPassword: "", newPassword: "", confirm: "" });
    if (forced) {
      router.push("/dashboard");
      router.refresh();
    } else setDone(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{forced ? "Senha provisória" : "Senha atual"}</label>
        <input type="password" required autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} className={input} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
        <input type="password" required minLength={8} autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} className={input} />
        <p className="text-xs text-gray-400 mt-1">Mínimo de 8 caracteres.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
        <input type="password" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={set("confirm")} className={input} />
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {done && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">Senha alterada.</div>}
      <button type="submit" disabled={loading}
        className="w-full bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
        {loading ? "Salvando..." : forced ? "Definir minha senha e entrar" : "Trocar senha"}
      </button>
    </form>
  );
}
