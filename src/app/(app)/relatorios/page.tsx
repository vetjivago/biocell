import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { seesAllUnits } from "@/lib/roles";
import { STANDARD_PRODUCTS } from "@/lib/products";

type Search = { de?: string; ate?: string; unidade?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Datas do filtro no horário de Brasília (o dia inteiro, de 00:00 a 23:59)
const startOf = (d: string) => new Date(`${d}T00:00:00-03:00`);
const endOf = (d: string) => new Date(`${d}T23:59:59.999-03:00`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Atalhos de período (hoje em Brasília)
function presets() {
  const today = new Date(Date.now() - 3 * 3600 * 1000);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  return [
    { label: "Este mês", de: iso(new Date(Date.UTC(y, m, 1))), ate: iso(today) },
    { label: "Mês passado", de: iso(new Date(Date.UTC(y, m - 1, 1))), ate: iso(new Date(Date.UTC(y, m, 0))) },
    { label: "Este ano", de: `${y}-01-01`, ate: iso(today) },
    { label: "Tudo", de: "", ate: "" },
  ];
}

const SPECIES = STANDARD_PRODUCTS.filter((p) => p.category === "CELULAS").map((p) => p.species!);
const fmtDay = (d: string) => d.split("-").reverse().join("/");

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;

  const allUnits = seesAllUnits(session.role);
  const unitOptions = await prisma.unit.findMany({
    where: allUnits ? {} : { id: { in: session.unitIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const unitName = Object.fromEntries(unitOptions.map((u) => [u.id, u.name]));
  const selectedUnit = sp.unidade && unitName[sp.unidade] ? sp.unidade : "";
  const unitFilter = selectedUnit ? { unitId: selectedUnit } : allUnits ? {} : { unitId: { in: session.unitIds } };

  const de = sp.de && DAY.test(sp.de) ? sp.de : "";
  const ate = sp.ate && DAY.test(sp.ate) ? sp.ate : "";
  const period = de || ate ? { createdAt: { ...(de ? { gte: startOf(de) } : {}), ...(ate ? { lte: endOf(ate) } : {}) } } : {};
  const cellsConsumption = { ...unitFilter, ...period, type: "CONSUMPTION", batch: { product: { category: "CELULAS" } } };

  const [records, completed, patients, consumptionByUnitBatch, recordsByUnit, pathologies, stockGroups] = await Promise.all([
    prisma.medicalRecord.count({ where: { ...unitFilter, ...period } }),
    prisma.medicalRecord.count({ where: { ...unitFilter, ...period, status: "COMPLETED" } }),
    prisma.medicalRecord.findMany({ where: { ...unitFilter, ...period }, select: { patientId: true }, distinct: ["patientId"] }),
    prisma.inventoryTransaction.groupBy({ by: ["unitId", "batchId"], _sum: { quantity: true }, where: cellsConsumption }),
    prisma.medicalRecord.groupBy({ by: ["unitId"], _count: true, where: { ...unitFilter, ...period } }),
    prisma.medicalRecord.groupBy({ by: ["pathology"], _count: true, where: { ...unitFilter, ...period } }),
    // Estoque é o saldo atual (não depende do período)
    prisma.inventoryTransaction.groupBy({ by: ["unitId", "batchId"], _sum: { quantity: true }, where: unitFilter }),
  ]);

  const batchIds = [...new Set([...consumptionByUnitBatch, ...stockGroups].map((g) => g.batchId))];
  const batches = await prisma.cellBatch.findMany({
    where: { id: { in: batchIds } },
    select: { id: true, product: { select: { category: true, species: true } } },
  });
  const productOf = Object.fromEntries(batches.map((b) => [b.id, b.product]));

  // Consumo de palhetas: total, por espécie e por unidade
  const used = (g: { _sum: { quantity: number | null } }) => Math.abs(g._sum.quantity || 0);
  const totalStraws = consumptionByUnitBatch.reduce((s, g) => s + used(g), 0);
  const strawsBySpecies = SPECIES.map((sp) => ({
    species: sp,
    value: consumptionByUnitBatch.filter((g) => productOf[g.batchId]?.species === sp).reduce((s, g) => s + used(g), 0),
  }));

  // Ranking das unidades: atendimentos e palhetas no período
  const unitRows = new Map<string, { unitId: string; records: number; straws: number }>();
  const row = (id: string) => unitRows.get(id) ?? unitRows.set(id, { unitId: id, records: 0, straws: 0 }).get(id)!;
  for (const r of recordsByUnit) row(r.unitId).records += r._count;
  for (const g of consumptionByUnitBatch) row(g.unitId).straws += used(g);
  const unitRanking = [...unitRows.values()].sort((a, b) => b.straws - a.straws || b.records - a.records);

  // Ranking das doenças: junta grafias diferentes da mesma doença (maiúsculas/espaços)
  const diseaseMap = new Map<string, { name: string; count: number }>();
  for (const p of pathologies) {
    const name = p.pathology.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    const cur = diseaseMap.get(key);
    diseaseMap.set(key, { name: cur?.name ?? name, count: (cur?.count ?? 0) + p._count });
  }
  const diseases = [...diseaseMap.values()].sort((a, b) => b.count - a.count);

  // Estoque atual por unidade
  type StockRow = { unitId: string; species: Record<string, number>; meio: number; soro: number; material: number; cells: number };
  const stockRows = new Map<string, StockRow>();
  for (const g of stockGroups) {
    const qty = g._sum.quantity || 0;
    const p = productOf[g.batchId];
    if (!qty || !p) continue;
    const r = stockRows.get(g.unitId) ?? stockRows.set(g.unitId, { unitId: g.unitId, species: {}, meio: 0, soro: 0, material: 0, cells: 0 }).get(g.unitId)!;
    if (p.category === "CELULAS") {
      r.cells += qty;
      if (p.species) r.species[p.species] = (r.species[p.species] ?? 0) + qty;
    } else if (p.category === "MEIO") r.meio += qty;
    else if (p.category === "SORO") r.soro += qty;
    else r.material += qty;
  }
  const stockTable = [...stockRows.values()].sort((a, b) => (unitName[a.unitId] ?? "").localeCompare(unitName[b.unitId] ?? ""));
  const stockTotal = stockTable.reduce(
    (t, r) => ({ cells: t.cells + r.cells, meio: t.meio + r.meio, soro: t.soro + r.soro, material: t.material + r.material,
      species: Object.fromEntries(SPECIES.map((s) => [s, (t.species[s] ?? 0) + (r.species[s] ?? 0)])) }),
    { cells: 0, meio: 0, soro: 0, material: 0, species: {} as Record<string, number> },
  );

  const periodLabel = de || ate ? `${de ? fmtDay(de) : "início"} a ${ate ? fmtDay(ate) : "hoje"}` : "Todo o período";
  const scopeLabel = selectedUnit ? unitName[selectedUnit] : allUnits ? "Todas as unidades" : unitOptions.map((u) => u.name).join(", ");
  const link = (q: Search) => {
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
    return `/relatorios${params.size ? `?${params}` : ""}`;
  };
  const field = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white";
  const card = "bg-white rounded-xl shadow-sm border border-gray-100 p-6";
  const th = "text-xs font-medium text-gray-500 px-3 py-2";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{scopeLabel} · {periodLabel}</p>

      {/* Filtros */}
      <form className={`${card} mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto] gap-3 items-end print:hidden`}>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">De</label>
          <input type="date" name="de" defaultValue={de} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Até</label>
          <input type="date" name="ate" defaultValue={ate} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
          <select name="unidade" defaultValue={selectedUnit} className={field}>
            <option value="">{allUnits ? "Visão geral (todas as unidades)" : "Todas as minhas unidades"}</option>
            {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <button type="submit" className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90">Filtrar</button>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2">
          {presets().map((p) => (
            <Link key={p.label} href={link({ de: p.de, ate: p.ate, unidade: selectedUnit })}
              className={`px-3 py-1 rounded-full text-xs border ${p.de === de && p.ate === ate ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              {p.label}
            </Link>
          ))}
        </div>
      </form>

      {/* Números do período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Atendimentos", value: records },
          { label: "Atendimentos concluídos", value: completed, cls: "text-green-600" },
          { label: "Pacientes atendidos", value: patients.length },
          { label: "Palhetas consumidas", value: totalStraws, cls: "text-red-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className={`text-3xl font-bold mt-1 ${c.cls ?? ""}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Consumo de palhetas */}
        <div className={card}>
          <h2 className="font-semibold text-gray-900 mb-1">Consumo de palhetas</h2>
          <p className="text-xs text-gray-400 mb-4">Baixas dos atendimentos concluídos no período</p>
          <div className="grid grid-cols-3 gap-3">
            {strawsBySpecies.map((s) => (
              <div key={s.species} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{s.species}</p>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">Total: <strong>{totalStraws}</strong> palhetas</p>
        </div>

        {/* Ranking das doenças */}
        <div className={card}>
          <h2 className="font-semibold text-gray-900 mb-4">Ranking das doenças</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {diseases.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-6">{i + 1}.</span>
                <div className="flex-1">
                  <div className="flex justify-between gap-2 mb-1">
                    <span className="text-sm text-gray-700">{d.name}</span>
                    <span className="text-sm font-bold text-gray-900">{d.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-primary rounded-full h-2" style={{ width: `${(d.count / diseases[0].count) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {diseases.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sem atendimentos no período</p>}
          </div>
        </div>
      </div>

      {/* Ranking das unidades */}
      {!selectedUnit && unitRanking.length > 0 && (
        <div className={`${card} mb-6`}>
          <h2 className="font-semibold text-gray-900 mb-4">Ranking das unidades</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className={th}>#</th>
                  <th className={th}>Unidade</th>
                  <th className={`${th} text-right`}>Palhetas consumidas</th>
                  <th className={`${th} text-right`}>Atendimentos</th>
                </tr>
              </thead>
              <tbody>
                {unitRanking.map((u, i) => (
                  <tr key={u.unitId} className="border-b border-gray-50 last:border-0 text-sm">
                    <td className="px-3 py-2 text-gray-400 font-bold">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={link({ de, ate, unidade: u.unitId })} className="text-gray-800 hover:text-primary hover:underline">{unitName[u.unitId] ?? u.unitId}</Link>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{u.straws}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{u.records}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estoque por unidade */}
      <div className={card}>
        <h2 className="font-semibold text-gray-900 mb-1">Estoque por unidade</h2>
        <p className="text-xs text-gray-400 mb-4">Saldo atual (não depende do período)</p>
        {stockTable.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sem estoque registrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] [&_td]:whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className={th}>Unidade</th>
                  {SPECIES.map((s) => <th key={s} className={`${th} text-right`}>CTM {s}</th>)}
                  <th className={`${th} text-right`}>Total palhetas</th>
                  <th className={`${th} text-right`}>Meio</th>
                  <th className={`${th} text-right`}>Soro</th>
                  <th className={`${th} text-right`}>Materiais</th>
                </tr>
              </thead>
              <tbody>
                {stockTable.map((r) => (
                  <tr key={r.unitId} className="border-b border-gray-50 text-sm">
                    <td className="px-3 py-2 text-gray-800">{unitName[r.unitId] ?? r.unitId}</td>
                    {SPECIES.map((s) => <td key={s} className="px-3 py-2 text-right text-gray-700">{r.species[s] ?? 0}</td>)}
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{r.cells}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.meio}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.soro}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.material}</td>
                  </tr>
                ))}
                {stockTable.length > 1 && (
                  <tr className="text-sm font-bold bg-gray-50">
                    <td className="px-3 py-2">Total</td>
                    {SPECIES.map((s) => <td key={s} className="px-3 py-2 text-right">{stockTotal.species[s] ?? 0}</td>)}
                    <td className="px-3 py-2 text-right">{stockTotal.cells}</td>
                    <td className="px-3 py-2 text-right">{stockTotal.meio}</td>
                    <td className="px-3 py-2 text-right">{stockTotal.soro}</td>
                    <td className="px-3 py-2 text-right">{stockTotal.material}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
