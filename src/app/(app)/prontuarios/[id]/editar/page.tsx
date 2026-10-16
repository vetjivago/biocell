"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface RecordData {
  id: string;
  pathology: string;
  cellQuantity: string | null;
  applicationRoute: string | null;
  donors: string | null;
  serumCollected: boolean;
  status: string;
  patient: {
    name: string;
    species: string;
    breed: string | null;
    weight: number | null;
    ownerName: string;
    ownerPhone: string | null;
    veterinarian: string | null;
    clinic: string | null;
  };
  applications: { number: number; date: string | null; cells: string | null; serum: string | null; medium: string | null }[];
  thawings: { number: number; thawedStraws: number | null; retrievalLocation: string | null }[];
}

export default function EditarProntuarioPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    patientName: "", patientSpecies: "", patientBreed: "",
    patientWeight: "", ownerName: "", ownerPhone: "",
    veterinarian: "", clinic: "",
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
    fetch(`/api/medical-records/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Não encontrado");
        return r.json();
      })
      .then((data: RecordData) => {
        if (data.status === "COMPLETED") {
          router.replace(`/prontuarios/${id}`);
          return;
        }
        setForm({
          patientName: data.patient.name,
          patientSpecies: data.patient.species,
          patientBreed: data.patient.breed || "",
          patientWeight: data.patient.weight?.toString() || "",
          ownerName: data.patient.ownerName || "",
          ownerPhone: data.patient.ownerPhone || "",
          veterinarian: data.patient.veterinarian || "",
          clinic: data.patient.clinic || "",
          pathology: data.pathology,
          cellQuantity: data.cellQuantity || "",
          applicationRoute: data.applicationRoute || "",
          donors: data.donors || "",
          serumCollected: data.serumCollected,
        });
        if (data.applications.length > 0) {
          setApplications(data.applications.map((a) => ({
            number: a.number,
            date: a.date ? a.date.split("T")[0] : "",
            cells: a.cells || "",
            serum: a.serum || "",
            medium: a.medium || "",
          })));
        }
        if (data.thawings.length > 0) {
          setThawings(data.thawings.map((t) => ({
            number: t.number,
            thawedStraws: t.thawedStraws?.toString() || "",
            retrievalLocation: t.retrievalLocation || "",
          })));
        }
        setLoading(false);
      })
      .catch(() => {
        router.replace(`/prontuarios/${id}`);
      });
  }, [id, router]);

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
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      applications: applications.filter((a) => a.date || a.cells),
      thawings: thawings
        .filter((t) => t.thawedStraws || t.retrievalLocation)
        .map((t) => ({ ...t, thawedStraws: t.thawedStraws ? parseInt(t.thawedStraws) : null })),
    };

    const res = await fetch(`/api/medical-records/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/prontuarios/${id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Erro ao salvar");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/prontuarios/${id}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar ao prontuário
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Prontuário</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados do Animal */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Dados do Animal</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Paciente *</label>
              <input required value={form.patientName} onChange={(e) => update("patientName", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
              <input value={form.patientBreed} onChange={(e) => update("patientBreed", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Ex: Labrador" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <input type="number" step="0.1" value={form.patientWeight} onChange={(e) => update("patientWeight", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável (Tutor)</label>
              <input value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone do Responsável</label>
              <input value={form.ownerPhone} onChange={(e) => update("ownerPhone", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="(61) 99999-9999" />
            </div>
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
        </div>

        {/* Protocolo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Protocolo de Tratamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patologia *</label>
              <input required value={form.pathology} onChange={(e) => update("pathology", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Células</label>
              <input value={form.cellQuantity} onChange={(e) => update("cellQuantity", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Ex: 6 palhetas" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Via de Aplicação</label>
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{app.number}ª Aplicação</p>
                {applications.length > 1 && (
                  <button type="button" onClick={() => setApplications((a) => a.filter((_, j) => j !== i).map((a, j) => ({ ...a, number: j + 1 })))}
                    className="text-xs text-red-500 hover:underline">Remover</button>
                )}
              </div>
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{thaw.number}º Descongelamento</p>
                {thawings.length > 1 && (
                  <button type="button" onClick={() => setThawings((t) => t.filter((_, j) => j !== i).map((t, j) => ({ ...t, number: j + 1 })))}
                    className="text-xs text-red-500 hover:underline">Remover</button>
                )}
              </div>
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

        <button type="submit" disabled={saving}
          className="w-full bg-primary hover:bg-primary-light text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 text-lg">
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </form>
    </div>
  );
}
