"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { normalizeSpecies } from "@/lib/species";
import { PATHOLOGIES } from "@/lib/pathologies";
import { PRODUCT_CATEGORIES, lotLabel, type ProductCategory } from "@/lib/products";
import { compressImage } from "@/lib/compress-image";

interface Unit { id: string; name: string; }
interface AppItem { category: Category; batchId: string; quantity: string; }
interface AppEntry { number: number; date: string; preparedBy?: string; cells: string; serum: string; medium: string; items: AppItem[]; itemsInit?: boolean; readonly?: boolean; }
interface StockItem { batchId: string; batchNumber: string; productName: string; category: string; balance: number; expirationDate: string | null; species: string | null; }

type Category = ProductCategory;

function lotsFor(stock: StockItem[], category: Category, patientSpecies: string) {
  const lots = stock.filter((s) => s.category === category);
  if (category !== "CELULAS" && category !== "SORO") return lots;
  const patientKind = normalizeSpecies(patientSpecies);
  if (!patientKind) return lots;
  return lots.filter((l) => {
    const kind = normalizeSpecies(l.species) || normalizeSpecies(l.productName);
    return !kind || kind === patientKind;
  });
}
const ITEM_CATEGORIES = PRODUCT_CATEGORIES;
interface ThawEntry { number: number; thawedStraws: string; thawedMeio: string; thawedSoro: string; retrievalLocation: string; readonly?: boolean; }



// Uma linha por categoria (materiais só quando adicionados); pré-seleciona o lote quando a unidade só tem um daquela categoria
function defaultItemsFor(list: StockItem[], patientSpecies: string): AppItem[] {
  return ITEM_CATEGORIES.filter((c) => c.key !== "MATERIAL").map((c) => {
    const lots = lotsFor(list, c.key, patientSpecies);
    return { category: c.key, batchId: lots.length === 1 ? lots[0].batchId : "", quantity: "" };
  });
}

function NovoProntuarioForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");
  const osAppId = searchParams.get("osApp");
  const [osApp, setOsApp] = useState<{
    id: string; number: number; status: string; medicalRecordId: string | null; date: string | null; veterinarian: string | null; technicalNotes: string | null;
    applicationRoute: string | null; cellQuantity: string | null; preparation: string | null;
    serviceOrder: { id: string; serialNumber: string; patientId: string; disease: string | null };
  } | null>(null);

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(!!patientId);
  const [error, setError] = useState("");
  const [isExistingPatient, setIsExistingPatient] = useState(false);
  const [isCustomPathology, setIsCustomPathology] = useState(false);
  const [form, setForm] = useState({
    patientName: "", patientSpecies: "", patientBreed: "",
    patientWeight: "", ownerName: "", veterinarian: "", clinic: "",
    unitId: "",
    pathology: "", cellQuantity: "", applicationRoute: "",
    donors: "", serumCollected: false,
  });
  const [stock, setStock] = useState<StockItem[] | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  // Cópia do estoque para os callbacks assíncronos (o paciente e o estoque podem chegar em qualquer ordem)
  const stockRef = useRef<StockItem[] | null>(null);
  const [applications, setApplications] = useState<AppEntry[]>([
    { number: 1, date: "", cells: "", serum: "", medium: "", items: [] },
  ]);
  const [thawings, setThawings] = useState<ThawEntry[]>([
    { number: 1, thawedStraws: "", thawedMeio: "", thawedSoro: "", retrievalLocation: "" },
  ]);

  useEffect(() => {
    fetch("/api/units").then((r) => r.json()).then(setUnits);
  }, []);

  useEffect(() => {
    if (!patientId) return;
    // Paciente e (se houver) a aplicação da OS são carregados juntos: a doença da OS vale para este tratamento
    Promise.all([
      fetch(`/api/patients/${patientId}`).then((r) => r.json()),
      osAppId ? fetch(`/api/service-order-applications/${osAppId}`).then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([data, os]) => {
        if (os?.error) setError(os.error);
        else if (os) setOsApp(os);
        const osDisease: string | null = os && !os.error ? os.serviceOrder.disease : null;
        if (data.error) {
          setError(data.error);
          setLoadingPatient(false);
          return;
        }
        setIsExistingPatient(true);
        const p = data.patient;
        const lr = data.lastRecord;
        // Doença da OS na grafia da lista, quando bate (ex.: "doença renal crônica")
        const rawPathology = (osDisease || lr?.pathology || "").trim();
        const pathology = PATHOLOGIES.find((x) => x.toLowerCase() === rawPathology.toLowerCase()) || rawPathology;
        if (pathology && !PATHOLOGIES.includes(pathology)) {
          setIsCustomPathology(true);
        }
        setForm({
          patientName: p.name,
          patientSpecies: p.species,
          patientBreed: p.breed || "",
          patientWeight: p.weight?.toString() || "",
          ownerName: p.ownerName,
          veterinarian: (os && !os.error && os.veterinarian) || p.veterinarian || "",
          clinic: p.clinic || "",
          unitId: p.unitId,
          pathology,
          // Protocolo da OS vale para esta aplicação (sem OS: repete o do último prontuário)
          cellQuantity: (os && !os.error && os.cellQuantity) || lr?.cellQuantity || "",
          applicationRoute: (os && !os.error && os.applicationRoute) || lr?.applicationRoute || "",
          donors: lr?.donors || "",
          serumCollected: lr?.serumCollected || false,
        });

        const prevApps: AppEntry[] = (data.previousApplications || []).map((a: AppEntry) => ({
          ...a, items: [], readonly: true,
        }));
        const nextAppNum = prevApps.length > 0 ? Math.max(...prevApps.map((a: AppEntry) => a.number)) + 1 : 1;
        const osDate = os && !os.error && os.date ? String(os.date).slice(0, 10) : "";
        setApplications([
          ...prevApps,
          stockRef.current
            ? { number: nextAppNum, date: osDate, preparedBy: "", cells: "", serum: "", medium: "", items: defaultItemsFor(stockRef.current, p.species), itemsInit: true }
            : { number: nextAppNum, date: osDate, preparedBy: "", cells: "", serum: "", medium: "", items: [] },
        ]);

        const prevThaws: ThawEntry[] = (data.previousThawings || []).map((t: ThawEntry) => ({
          ...t, readonly: true,
        }));
        const nextThawNum = prevThaws.length > 0 ? Math.max(...prevThaws.map((t: ThawEntry) => t.number)) + 1 : 1;
        setThawings([
          ...prevThaws,
          { number: nextThawNum, thawedStraws: "", thawedMeio: "", thawedSoro: "", retrievalLocation: "" },
        ]);

        setLoadingPatient(false);
      })
      .catch(() => {
        setError("Erro ao carregar dados do paciente");
        setLoadingPatient(false);
      });
  }, [patientId, osAppId]);

  const species = form.patientSpecies;
  // Lotes disponíveis no estoque da unidade do paciente (abastecidos pela matriz)
  useEffect(() => {
    if (!form.unitId) return;
    fetch(`/api/inventory/stock?unitId=${form.unitId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StockItem[]) => {
        stockRef.current = data;
        setStock(data);
        setApplications((apps) => apps.map((a) => (a.readonly || a.itemsInit ? a : { ...a, items: defaultItemsFor(data, species), itemsInit: true })));
      })
      .catch(() => setStock([]));
  }, [form.unitId, species]);

  function newApplication(number: number): AppEntry {
    return { number, date: "", preparedBy: "", cells: "", serum: "", medium: "", items: stock ? defaultItemsFor(stock, form.patientSpecies) : [], itemsInit: !!stock };
  }

  function updateItem(appIdx: number, itemIdx: number, field: "batchId" | "quantity", value: string) {
    setApplications((apps) => apps.map((a, j) => j !== appIdx ? a : {
      ...a, items: a.items.map((it, k) => k === itemIdx ? { ...it, [field]: value } : it),
    }));
  }

  function addItem(appIdx: number, category: Category) {
    setApplications((apps) => apps.map((a, j) => {
      if (j !== appIdx) return a;
      const lastIdx = a.items.map((it) => it.category).lastIndexOf(category);
      const items = [...a.items];
      items.splice(lastIdx === -1 ? items.length : lastIdx + 1, 0, { category, batchId: "", quantity: "" });
      return { ...a, items };
    }));
  }

  function removeItem(appIdx: number, itemIdx: number) {
    setApplications((apps) => apps.map((a, j) => j !== appIdx ? a : {
      ...a, items: a.items.filter((_, k) => k !== itemIdx),
    }));
  }

  // Saldo do lote descontando o que já foi alocado nas outras linhas deste prontuário
  function remainingFor(batchId: string, exclude: { appIdx: number; itemIdx: number }) {
    const lot = stock?.find((s) => s.batchId === batchId);
    if (!lot) return 0;
    const allocated = applications.reduce((sum, a, j) => sum + (a.readonly ? 0 : a.items.reduce((s2, it, k) =>
      s2 + (it.batchId === batchId && !(j === exclude.appIdx && k === exclude.itemIdx) ? parseInt(it.quantity) || 0 : 0), 0)), 0);
    return lot.balance - allocated;
  }

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

    const fail = (msg: string) => {
      setError(msg);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    for (const a of applications.filter((x) => !x.readonly)) {
      if (a.items.some((it) => Boolean(it.batchId) !== (parseInt(it.quantity) > 0))) {
        return fail(`${a.number}ª aplicação: informe lote e quantidade em cada linha (ou remova a linha)`);
      }
      if (!a.items.some((it) => it.category === "SORO" && it.batchId && parseInt(it.quantity) > 0)) {
        return fail(`${a.number}ª aplicação: informe o lote do soro`);
      }
      if (!a.preparedBy?.trim()) return fail(`${a.number}ª aplicação: informe o responsável pelo preparo`);
    }
    if (photos.length === 0) return fail("Anexe a foto das palhetas");

    const newApps = applications
      .filter((a) => !a.readonly)
      .map((a) => ({
        number: a.number,
        date: a.date,
        preparedBy: a.preparedBy,
        items: a.items
          .filter((it) => it.batchId && parseInt(it.quantity) > 0)
          .map((it) => ({ batchId: it.batchId, category: it.category, quantity: parseInt(it.quantity) })),
      }))
      .filter((a) => a.date || a.items.length > 0);
    const newThaws = thawings
      .filter((t) => !t.readonly && (t.thawedStraws || t.thawedMeio || t.thawedSoro || t.retrievalLocation))
      .map((t) => ({
        ...t,
        thawedStraws: t.thawedStraws ? parseInt(t.thawedStraws) : null,
        thawedMeio: t.thawedMeio ? parseInt(t.thawedMeio) : null,
        thawedSoro: t.thawedSoro ? parseInt(t.thawedSoro) : null,
      }));

    const payload = {
      ...form,
      ...(isExistingPatient ? { patientId } : {}),
      ...(osApp ? { serviceOrderApplicationId: osApp.id } : {}),
      patientWeight: form.patientWeight ? parseFloat(form.patientWeight) : null,
      applications: newApps,
      thawings: newThaws,
    };

    const res = await fetch("/api/medical-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const record = await res.json();
      // Fotos das palhetas vão depois do prontuário criado; se alguma falhar, dá para anexar na tela do prontuário
      let failed = 0;
      for (const photo of photos) {
        const body = new FormData();
        body.append("file", await compressImage(photo));
        const up = await fetch(`/api/medical-records/${record.id}/attachments`, { method: "POST", body }).catch(() => null);
        if (!up?.ok) failed++;
      }
      router.push(`/prontuarios/${record.id}${failed ? "?fotos=erro" : ""}`);
    } else {
      const data = await res.json().catch(() => ({ error: "Erro ao registrar" }));
      setError(data.error || "Erro ao registrar prontuário");
    }
    setLoading(false);
  }

  if (!patientId) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Selecione um paciente</h1>
          <p className="text-sm text-gray-500 mb-6">
            Novos prontuários são abertos a partir da aba Pacientes: escolha um paciente já cadastrado
            ou cadastre um novo paciente.
          </p>
          <Link href="/pacientes" className="inline-block bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-lg text-sm font-medium">
            Ir para Pacientes
          </Link>
        </div>
      </div>
    );
  }

  if (loadingPatient) {
    return (
      <div className="max-w-3xl">
        <div className="text-center py-12 text-gray-400">Carregando dados do paciente...</div>
      </div>
    );
  }

  const editableApps = applications.filter((a) => !a.readonly);
  const readonlyApps = applications.filter((a) => a.readonly);
  const editableThaws = thawings.filter((t) => !t.readonly);
  const readonlyThaws = thawings.filter((t) => t.readonly);
  const maxAppNum = Math.max(...applications.map((a) => a.number));
  const maxThawNum = Math.max(...thawings.map((t) => t.number));

  return (
    <div className="max-w-3xl">
      <Link href={`/pacientes/${patientId}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isExistingPatient ? `Novo Prontuário – ${form.patientName}` : "Novo Prontuário de Células-Tronco"}
      </h1>

      {osApp && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm mb-4">
          Preenchendo a partir da <Link href={`/ordens-servico/${osApp.serviceOrder.id}`} className="font-semibold underline">OS nº {osApp.serviceOrder.serialNumber}</Link> – {osApp.number}ª aplicação
          {osApp.veterinarian ? ` · Veterinário afiliado: ${osApp.veterinarian}` : ""}
          {(osApp.applicationRoute || osApp.cellQuantity) && (
            <span className="block mt-1"><strong>Via:</strong> {osApp.applicationRoute || "–"} · <strong>Quantidade de células:</strong> {osApp.cellQuantity || "–"}</span>
          )}
          {osApp.preparation ? <span className="block mt-1 whitespace-pre-line"><strong>Forma de preparo:</strong> {osApp.preparation}</span> : null}
          {osApp.technicalNotes ? <span className="block mt-1 whitespace-pre-line">Observações técnicas: {osApp.technicalNotes}</span> : null}
          {osApp.medicalRecordId ? <span className="block mt-1 font-semibold">Esta aplicação já tem prontuário preenchido.</span> : null}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Identificação</h2>
          {isExistingPatient && (
            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm mb-4">
              Dados do paciente preenchidos automaticamente
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
              <select required value={form.unitId} onChange={(e) => update("unitId", e.target.value)}
                disabled={isExistingPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600">
                <option value="">Selecione...</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Paciente (Animal) *</label>
              <input required value={form.patientName} onChange={(e) => update("patientName", e.target.value)}
                readOnly={isExistingPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm read-only:bg-gray-50 read-only:text-gray-600"
                placeholder="Ex: Rex" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Espécie *</label>
              <select required value={form.patientSpecies} onChange={(e) => update("patientSpecies", e.target.value)}
                disabled={isExistingPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600">
                <option value="">Selecione...</option>
                <option value="Canino">Canino</option>
                <option value="Felino">Felino</option>
                <option value="Equino">Equino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
              <input value={form.patientBreed} onChange={(e) => update("patientBreed", e.target.value)}
                readOnly={isExistingPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm read-only:bg-gray-50 read-only:text-gray-600"
                placeholder="Ex: Golden Retriever" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <input type="number" step="0.1" min="0" value={form.patientWeight}
                onChange={(e) => update("patientWeight", e.target.value)}
                readOnly={isExistingPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm read-only:bg-gray-50 read-only:text-gray-600"
                placeholder="Ex: 12.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável (Tutor) *</label>
              <input required value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)}
                readOnly={isExistingPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm read-only:bg-gray-50 read-only:text-gray-600"
                placeholder="Nome do tutor" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veterinário afiliado</label>
              <input value={form.veterinarian} onChange={(e) => update("veterinarian", e.target.value)}
                readOnly={isExistingPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm read-only:bg-gray-50 read-only:text-gray-600"
                placeholder="Nome do veterinário afiliado" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clínica</label>
              <input value={form.clinic} onChange={(e) => update("clinic", e.target.value)}
                readOnly={isExistingPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm read-only:bg-gray-50 read-only:text-gray-600"
                placeholder="Nome da clínica" />
            </div>
          </div>
        </div>

        {/* Protocolo de Tratamento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Protocolo de Tratamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patologia *</label>
              <select
                value={isCustomPathology ? "__OTHER__" : form.pathology}
                onChange={(e) => {
                  if (e.target.value === "__OTHER__") {
                    setIsCustomPathology(true);
                    update("pathology", "");
                  } else {
                    setIsCustomPathology(false);
                    update("pathology", e.target.value);
                  }
                }}
                required={!isCustomPathology}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Selecione a patologia...</option>
                {PATHOLOGIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="__OTHER__">Outra (especificar)</option>
              </select>
              {isCustomPathology && (
                <input
                  required
                  value={form.pathology}
                  onChange={(e) => update("pathology", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-2"
                  placeholder="Descreva a patologia ou condição especial"
                />
              )}
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
            {applications.length < 6 && (
              <button type="button" onClick={() => setApplications((a) => [...a, newApplication(maxAppNum + 1)])}
                className="text-sm text-primary hover:underline">+ Adicionar</button>
            )}
          </div>

          {readonlyApps.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Aplicações anteriores</p>
              {readonlyApps.map((app) => (
                <div key={`prev-${app.number}`} className="mb-2 p-3 bg-gray-100 rounded-lg opacity-70">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="font-medium">{app.number}ª</span>
                    <span>{app.date || "–"}</span>
                    <span>Células: {app.cells || "–"}</span>
                    <span>Soro: {app.serum || "–"}</span>
                    <span>Meio: {app.medium || "–"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {readonlyApps.length > 0 && (
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Nova aplicação</p>
          )}
          {editableApps.map((app) => {
            const idx = applications.indexOf(app);
            return (
              <div key={idx} className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-medium text-gray-700">{app.number}ª Aplicação</p>
                  {editableApps.length > 1 && (
                    <button type="button" onClick={() => setApplications((apps) => apps.filter((_, j) => j !== idx))}
                      className="text-xs text-gray-400 hover:text-red-500">Remover</button>
                  )}
                </div>
                <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Data</label>
                    <input type="date" value={app.date} onChange={(e) => updateApp(idx, "date", e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Responsável pelo preparo *</label>
                    <input value={app.preparedBy ?? ""} onChange={(e) => updateApp(idx, "preparedBy", e.target.value)}
                      required placeholder="Quem preparou as células"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
                  </div>
                </div>

                <div className="space-y-3">
                  {ITEM_CATEGORIES.map((cat) => {
                    const lots = lotsFor(stock || [], cat.key, form.patientSpecies);
                    const rows = app.items.map((it, k) => ({ it, k })).filter(({ it }) => it.category === cat.key);
                    return (
                      <div key={cat.key} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{cat.label}{cat.key === "SORO" ? " * (lote obrigatório)" : ""}</p>
                          {lots.length > 0 && (
                            <button type="button" onClick={() => addItem(idx, cat.key)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline">
                              <Plus size={12} /> {cat.key === "MATERIAL" ? "Adicionar material" : rows.length === 0 ? "Adicionar lote" : "Outro lote"}
                            </button>
                          )}
                        </div>
                        {stock === null ? (
                          <p className="text-xs text-gray-400">Carregando lotes...</p>
                        ) : lots.length === 0 ? (
                          <p className="text-xs text-amber-600">
                            Nenhum lote de {cat.label.toLowerCase()} no estoque da unidade. Solicite abastecimento à matriz.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {rows.length === 0 && (
                              <p className="text-xs text-gray-400">Não utilizado nesta aplicação.</p>
                            )}
                            {rows.map(({ it, k }) => {
                              const usedHere = rows.filter((r) => r.k !== k).map((r) => r.it.batchId);
                              const remaining = it.batchId ? remainingFor(it.batchId, { appIdx: idx, itemIdx: k }) : 0;
                              const over = Boolean(it.batchId) && (parseInt(it.quantity) || 0) > remaining;
                              return (
                                <div key={k} className="flex flex-wrap sm:flex-nowrap gap-2 items-start pb-2 sm:pb-0 border-b last:border-b-0 sm:border-b-0 border-gray-100">
                                  <select value={it.batchId} onChange={(e) => updateItem(idx, k, "batchId", e.target.value)}
                                    aria-label={`Lote de ${cat.label.toLowerCase()}`}
                                    className="w-full sm:w-auto sm:flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded text-sm bg-white">
                                    <option value="">{cat.key === "MATERIAL" ? "Selecione o material..." : "Selecione o lote..."}</option>
                                    {lots.filter((l) => l.batchId === it.batchId || !usedHere.includes(l.batchId)).map((l) => (
                                      <option key={l.batchId} value={l.batchId}>
                                        {lotLabel(l.batchNumber, l.productName)} ({remainingFor(l.batchId, { appIdx: idx, itemIdx: k })} disp.)
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex-1 sm:flex-none sm:w-24">
                                    <input type="number" inputMode="numeric" min="1" value={it.quantity}
                                      onChange={(e) => updateItem(idx, k, "quantity", e.target.value)}
                                      className={`w-full px-2 py-2 border rounded text-sm ${over ? "border-red-400" : "border-gray-300"}`}
                                      placeholder={cat.unit} aria-label={`Quantidade de ${cat.label.toLowerCase()} (${cat.unit})`} />
                                    {over && <p className="text-[11px] text-red-500 mt-0.5">Máx. {remaining}</p>}
                                  </div>
                                  <button type="button" onClick={() => removeItem(idx, k)} aria-label="Remover lote"
                                    className="p-2 text-gray-400 hover:text-red-500">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              );
                            })}
                            {rows.length > 1 && (
                              <p className="text-xs text-gray-500">
                                Total: {rows.reduce((sum, r) => sum + (parseInt(r.it.quantity) || 0), 0)} {cat.unit}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Descongelamento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Procedimento Inicial (Descongelamento)</h2>
            {thawings.length < 6 && (
              <button type="button" onClick={() => setThawings((t) => [...t, { number: maxThawNum + 1, thawedStraws: "", thawedMeio: "", thawedSoro: "", retrievalLocation: "" }])}
                className="text-sm text-primary hover:underline">+ Adicionar</button>
            )}
          </div>

          {readonlyThaws.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Descongelamentos anteriores</p>
              {readonlyThaws.map((thaw) => (
                <div key={`prev-${thaw.number}`} className="mb-2 p-3 bg-gray-100 rounded-lg opacity-70">
                  <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                    <span className="font-medium">{thaw.number}º</span>
                    <span>Palhetas: {thaw.thawedStraws || "–"}</span>
                    <span>Meio: {thaw.thawedMeio || "–"}</span>
                    <span>Soro: {thaw.thawedSoro || "–"}</span>
                    <span>Local: {thaw.retrievalLocation || "–"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {readonlyThaws.length > 0 && (
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Novo descongelamento</p>
          )}
          {editableThaws.map((thaw) => {
            const idx = thawings.indexOf(thaw);
            return (
              <div key={idx} className="mb-3 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">{thaw.number}º Descongelamento</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Palhetas (qtd)</label>
                    <input type="number" value={thaw.thawedStraws} onChange={(e) => updateThaw(idx, "thawedStraws", e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Meio (qtd)</label>
                    <input type="number" value={thaw.thawedMeio} onChange={(e) => updateThaw(idx, "thawedMeio", e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Soro (qtd)</label>
                    <input type="number" value={thaw.thawedSoro} onChange={(e) => updateThaw(idx, "thawedSoro", e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Local de Retirada</label>
                    <input value={thaw.retrievalLocation} onChange={(e) => updateThaw(idx, "retrievalLocation", e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      placeholder="Ex: Caneca 2" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Foto das palhetas (no papel, as palhetas eram coladas no prontuário) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Foto das palhetas *</h2>
          <p className="text-sm text-gray-500 mb-3">Tire uma foto das palhetas utilizadas e anexe aqui. Obrigatório.</p>
          {photos.length > 0 && (
            <ul className="mb-3 space-y-1">
              {photos.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label="Remover foto"
                    className="text-gray-400 hover:text-red-500"><X size={16} /></button>
                </li>
              ))}
            </ul>
          )}
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/5">
            <Camera size={16} /> {photos.length ? "Adicionar outra foto" : "Tirar / escolher foto"}
            <input type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={(e) => { const files = Array.from(e.target.files || []); setPhotos((ps) => [...ps, ...files]); e.target.value = ""; }} />
          </label>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-primary hover:bg-primary-light text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 text-lg">
          {loading ? "Salvando..." : "Registrar Prontuário"}
        </button>
      </form>
    </div>
  );
}

export default function NovoProntuarioPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl"><div className="text-center py-12 text-gray-400">Carregando...</div></div>}>
      <NovoProntuarioForm />
    </Suspense>
  );
}
