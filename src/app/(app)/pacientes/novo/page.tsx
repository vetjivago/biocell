"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NovoPacientePage() {
  const router = useRouter();
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", species: "Cão", breed: "", weight: "",
    ownerName: "", ownerPhone: "", ownerEmail: "",
    veterinarian: "", clinic: "", unitId: "",
  });

  useEffect(() => {
    fetch("/api/units").then((r) => r.json()).then((d) => {
      setUnits(d);
      if (d.length === 1) setForm((f) => ({ ...f, unitId: d[0].id }));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, weight: form.weight ? parseFloat(form.weight) : null }),
    });
    if (res.ok) {
      const patient = await res.json();
      router.push(`/pacientes/${patient.id}`);
    }
    setLoading(false);
  }

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <div className="max-w-2xl">
      <Link href="/pacientes" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Paciente</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Animal *</label>
            <input required value={form.name} onChange={(e) => update("name", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Espécie *</label>
            <select value={form.species} onChange={(e) => update("species", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option>Cão</option>
              <option>Gato</option>
              <option>Equino</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
            <input value={form.breed} onChange={(e) => update("breed", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
            <input type="number" step="0.1" value={form.weight} onChange={(e) => update("weight", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <hr className="my-2" />
        <h3 className="font-medium text-gray-800 text-sm">Responsável Legal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input required value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input value={form.ownerPhone} onChange={(e) => update("ownerPhone", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <hr className="my-2" />
        <h3 className="font-medium text-gray-800 text-sm">Veterinário / Clínica</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veterinário</label>
            <input value={form.veterinarian} onChange={(e) => update("veterinarian", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clínica</label>
            <input value={form.clinic} onChange={(e) => update("clinic", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
          <select required value={form.unitId} onChange={(e) => update("unitId", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Selecione...</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {loading ? "Salvando..." : "Cadastrar Paciente"}
        </button>
      </form>
    </div>
  );
}
