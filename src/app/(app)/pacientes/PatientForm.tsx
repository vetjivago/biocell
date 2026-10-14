"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface PatientFormValues {
  unitId: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  neutered: boolean;
  coat: string;
  birthDate: string; // AAAA-MM-DD
  weight: string;
  microchip: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerAddress: string;
  veterinarian: string;
  clinic: string;
}

export const EMPTY_PATIENT: PatientFormValues = {
  unitId: "", name: "", species: "Canino", breed: "", sex: "", neutered: false, coat: "", birthDate: "",
  weight: "", microchip: "", ownerName: "", ownerPhone: "", ownerEmail: "", ownerAddress: "", veterinarian: "", clinic: "",
};

const input = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const label = "block text-sm font-medium text-gray-700 mb-1";

export default function PatientForm({ patientId, initial }: { patientId?: string; initial: PatientFormValues }) {
  const router = useRouter();
  const isEdit = !!patientId;
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEdit) return;
    fetch("/api/units").then((r) => r.json()).then((d: { id: string; name: string }[]) => {
      setUnits(d);
      if (d.length === 1) setForm((f) => ({ ...f, unitId: d[0].id }));
    });
  }, [isEdit]);

  const set = (field: keyof PatientFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { unitId, ...rest } = form;
    const res = await fetch(isEdit ? `/api/patients/${patientId}` : "/api/patients", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, ...(isEdit ? {} : { unitId }), birthDate: form.birthDate || null, weight: form.weight || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Erro ao salvar paciente");
      setLoading(false);
      return;
    }
    router.push(`/pacientes/${isEdit ? patientId : data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <h3 className="font-medium text-gray-800 text-sm">Animal</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={label}>Nome do animal *</label><input required value={form.name} onChange={set("name")} className={input} /></div>
        <div>
          <label className={label}>Espécie *</label>
          <select value={form.species} onChange={set("species")} className={input}>
            <option>Canino</option><option>Felino</option><option>Equino</option>
          </select>
        </div>
        <div><label className={label}>Raça</label><input value={form.breed} onChange={set("breed")} className={input} /></div>
        <div><label className={label}>Pelagem</label><input value={form.coat} onChange={set("coat")} className={input} placeholder="Ex: Amarelo" /></div>
        <div>
          <label className={label}>Sexo</label>
          <select value={form.sex} onChange={set("sex")} className={input}>
            <option value="">–</option><option>Macho</option><option>Fêmea</option>
          </select>
        </div>
        <div className="flex items-center gap-2 sm:pt-7">
          <input id="neutered" type="checkbox" checked={form.neutered} onChange={set("neutered")} className="rounded border-gray-300" />
          <label htmlFor="neutered" className="text-sm text-gray-700">Castrado(a)</label>
        </div>
        <div><label className={label}>Data de nascimento</label><input type="date" value={form.birthDate} onChange={set("birthDate")} className={input} /></div>
        <div><label className={label}>Peso (kg)</label><input inputMode="decimal" value={form.weight} onChange={set("weight")} className={input} placeholder="Ex: 5,8" /></div>
        <div><label className={label}>Microchip</label><input value={form.microchip} onChange={set("microchip")} className={input} /></div>
      </div>

      <hr className="my-2" />
      <h3 className="font-medium text-gray-800 text-sm">Responsável (tutor)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={label}>Nome *</label><input required value={form.ownerName} onChange={set("ownerName")} className={input} /></div>
        <div><label className={label}>Telefone</label><input type="tel" value={form.ownerPhone} onChange={set("ownerPhone")} className={input} placeholder="(61) 90000-0000" /></div>
        <div><label className={label}>E-mail</label><input type="email" value={form.ownerEmail} onChange={set("ownerEmail")} className={input} /></div>
        <div><label className={label}>Endereço</label><input value={form.ownerAddress} onChange={set("ownerAddress")} className={input} /></div>
      </div>

      <hr className="my-2" />
      <h3 className="font-medium text-gray-800 text-sm">Veterinário / Clínica</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={label}>Veterinário</label><input value={form.veterinarian} onChange={set("veterinarian")} className={input} /></div>
        <div><label className={label}>Clínica</label><input value={form.clinic} onChange={set("clinic")} className={input} /></div>
      </div>

      {!isEdit && (
        <div>
          <label className={label}>Unidade *</label>
          <select required value={form.unitId} onChange={set("unitId")} className={input}>
            <option value="">Selecione...</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <button type="submit" disabled={loading}
        className="w-full bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
        {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar paciente"}
      </button>
    </form>
  );
}
