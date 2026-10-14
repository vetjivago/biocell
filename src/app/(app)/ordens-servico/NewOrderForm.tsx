"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PATHOLOGIES } from "@/lib/pathologies";

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-sm font-medium text-gray-700 mb-1";

export default function NewOrderForm({
  patientId, suggestedSerial, defaults,
}: {
  patientId: string;
  suggestedSerial: string;
  defaults: { veterinarian: string; clinic: string; city: string; disease: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    serialNumber: suggestedSerial,
    clinic: defaults.clinic,
    city: defaults.city,
    disease: defaults.disease,
    diagnosisTime: "",
    date: "",
    veterinarian: defaults.veterinarian,
    financial: "",
    technicalNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/service-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        serialNumber: form.serialNumber,
        clinic: form.clinic, city: form.city, disease: form.disease, diagnosisTime: form.diagnosisTime,
        application: { date: form.date || null, veterinarian: form.veterinarian, financial: form.financial, technicalNotes: form.technicalNotes },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Erro ao abrir a ordem de serviço");
      setSaving(false);
      return;
    }
    router.push(`/ordens-servico/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="sm:w-1/2">
          <label className={label}>Nº de série *</label>
          <input required value={form.serialNumber} onChange={set("serialNumber")} className={`${input} font-mono`} placeholder="02.078.26" />
          <p className="text-xs text-gray-400 mt-1">Sugerido o próximo da sequência; pode alterar.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-blue-700">1ª Aplicação</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Data</label>
            <input type="date" value={form.date} onChange={set("date")} className={input} />
          </div>
          <div>
            <label className={label}>Veterinário responsável</label>
            <input value={form.veterinarian} onChange={set("veterinarian")} className={input} />
          </div>
          <div>
            <label className={label}>Clínica</label>
            <input value={form.clinic} onChange={set("clinic")} className={input} />
          </div>
          <div>
            <label className={label}>Cidade</label>
            <input value={form.city} onChange={set("city")} className={input} />
          </div>
          <div>
            <label className={label}>Doença</label>
            <input list="os-pathologies" value={form.disease} onChange={set("disease")} className={input} placeholder="Ex: Doença renal crônica (DRC)" />
            <datalist id="os-pathologies">
              {PATHOLOGIES.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div>
            <label className={label}>Tempo de diagnóstico</label>
            <input value={form.diagnosisTime} onChange={set("diagnosisTime")} className={input} placeholder="Ex: 2 anos" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Financeiro</label>
            <input value={form.financial} onChange={set("financial")} className={input} placeholder="Ex: Pago – PIX R$ 2.250,00" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Observações técnicas</label>
            <textarea value={form.technicalNotes} onChange={set("technicalNotes")} rows={4} className={input} />
          </div>
        </div>
        <p className="text-xs text-gray-400">O checklist de termos fica disponível na OS depois de aberta.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      <button type="submit" disabled={saving}
        className="w-full bg-primary hover:bg-primary-light text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50">
        {saving ? "Abrindo..." : "Abrir ordem de serviço"}
      </button>
    </form>
  );
}
