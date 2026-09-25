"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Unit { id: string; name: string; }

export default function NovoProntuarioPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    patientName: "", patientSpecies: "", unitId: "",
    pathology: "", cellQuantity: "", applicationRoute: "",
    donors: "", serumCollected: false,
  });
  const [applications, setApplications] = useState([
    { number: 1, date: "", cells: "", serum: "", medium: "" },
  ]);
  const [thawings, setThawings] = useState([
    { number: 1, thawedStraws: "", retrievalLocation: "" },
  ]);

  useEffect(() => {
    fetch("/api/units").then((r) => r.json()).then(setUnits);
  }, []);

  function update(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateApp(i: number, field: string, value: string) {
    setApplications((apps) => apps.map((a, j) => j === i ? { ...a, [field]: value } : a));
  }

  function updateThaw(i: number, field: string, value: string) {
    setThawings((ts) => ts.map((t, j) => j === i ? { ...t, [field]: value } : t));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      applications: applications.filter((a) => a.date || a.cells),
      thawings: thawings
        .filter((t) => t.thawedStraws || t.retrievalLocation)
        .map((t) => ({ ...t, thawedStraws: t.thawedStraws ? parseInt(t.thawedStraws) : null })),
    };

    const res = await fetch("/api/medical-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const record = await res.json();
      router.push(`/prontuarios/${record.id}`);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-3xl">
      <Link href="/prontuarios" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Prontuário de Células-Tronco</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Identificação</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
              <select required value={form.unitId} onChange={(e) => update("unitId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Selecione...</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Paciente (Animal) *</label>
              <input required value={form.patientName} onChange={(e) => update("patientName", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Ex: Rex" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Espécie *</label>
              <select required value={form.patientSpecies} onChange={(e) => update("patientSpecies", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Selecione...</option>
                <option value="Canino">Canino</option>
                <option value="Felino">Felino</option>
                <option value="Equino">Equino</option>
              </select>
            </div>
          </div>
        </div>

        {/* Protocolo de Tratamento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Protocolo de Tratamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patologia *</label>
              <input required value={form.pathology} onChange={(e) => update("pathology", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Ex: Displasia coxofemoral bilateral" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Células</label>
              <input value={form.cellQuantity} onChange={(e) => update("cellQuantity", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Ex: 6 palhetas" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vias de Aplicação</label>
              <input value={form.applicationRoute} onChange={(e) => update("applicationRoute", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Ex: Intra-articular" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doadores</label>
              <input value={form.donors} onChange={(e) => update("donors", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="serum" checked={form.serumCollected}
                onChange={(e) => update("serumCollected", e.target.checked)}
                className="rounded border-gray-300" />
              <label htmlFor="serum" className="text-sm text-gray-700">Soro Coletado</label>
            </div>
          </div>
        </div>

        {/* Aplicações */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Aplicações</h2>
            {applications.length < 4 && (
              <button type="button" onClick={() => setApplications((a) => [...a, { number: a.length + 1, date: "", cells: "", serum: "", medium: "" }])}
                className="text-sm text-primary hover:underline">+ Adicionar</button>
            )}
          </div>
          {applications.map((app, i) => (
            <div key={i} className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">{app.number}ª Aplicação</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Data</label>
                  <input type="date" value={app.date} onChange={(e) => updateApp(i, "date", e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Células</label>
                  <input value={app.cells} onChange={(e) => updateApp(i, "cells", e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Soro</label>
                  <input value={app.serum} onChange={(e) => updateApp(i, "serum", e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Meio</label>
                  <input value={app.medium} onChange={(e) => updateApp(i, "medium", e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Descongelamento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Procedimento Inicial (Descongelamento)</h2>
            {thawings.length < 4 && (
              <button type="button" onClick={() => setThawings((t) => [...t, { number: t.length + 1, thawedStraws: "", retrievalLocation: "" }])}
                className="text-sm text-primary hover:underline">+ Adicionar</button>
            )}
          </div>
          {thawings.map((thaw, i) => (
            <div key={i} className="mb-3 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">{thaw.number}º Descongelamento</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Palhetas Descongeladas (qtd)</label>
                  <input type="number" value={thaw.thawedStraws} onChange={(e) => updateThaw(i, "thawedStraws", e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Local de Retirada (Caneca)</label>
                  <input value={thaw.retrievalLocation} onChange={(e) => updateThaw(i, "retrievalLocation", e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="Ex: Caneca 2 – posição 5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-primary hover:bg-primary-light text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 text-lg">
          {loading ? "Salvando..." : "Registrar Prontuário"}
        </button>
      </form>
    </div>
  );
}
