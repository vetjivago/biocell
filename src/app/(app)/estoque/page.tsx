import { Suspense } from "react";
import { canSupplyStock, seesAllUnits } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Package, AlertTriangle, Beaker, Droplets, ChevronDown, Building2, Syringe } from "lucide-react";
import SupplyForm from "./SupplyForm";
import ReverseButton from "./ReverseButton";
import { NO_LOT, STANDARD_PRODUCTS } from "@/lib/products";

const SPECIES_COLOR: Record<string, string> = { Canino: "#005847", Felino: "#00af6b", Equino: "#b5832a" };

const DEFAULT_MIN_STRAWS = 15;

export default async function EstoquePage({ searchParams }: { searchParams: Promise<{ unidade?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { unidade } = await searchParams;

  const isAdmin = seesAllUnits(session.role);
  const unitFilter = isAdmin ? {} : { unitId: { in: session.unitIds } };

  const grouped = await prisma.inventoryTransaction.groupBy({
    by: ["unitId", "batchId"],
    _sum: { quantity: true },
    where: unitFilter,
  });

  const batchIds = [...new Set(grouped.map((g) => g.batchId))];
  const unitIds = [...new Set(grouped.map((g) => g.unitId))];

  const [batches, units, thresholds, activeAlerts, recentTransactions] = await Promise.all([
    prisma.cellBatch.findMany({
      where: { id: { in: batchIds } },
      include: { product: { select: { name: true, code: true, species: true, category: true } } },
    }),
    prisma.unit.findMany({ where: { id: { in: unitIds } }, select: { id: true, name: true, city: true, state: true } }),
    prisma.stockThreshold.findMany({ where: { unitId: { in: unitIds } }, select: { unitId: true, minimumStraws: true } }),
    prisma.alert.count({ where: { ...unitFilter, resolved: false, type: "LOW_STOCK" } }),
    prisma.inventoryTransaction.findMany({
      where: unitFilter,
      include: {
        batch: { include: { product: { select: { name: true } } } },
        unit: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Recebimentos já estornados não mostram o botão de novo
  const canSupply = canSupplyStock(session.role);
  const reversedIds = new Set(
    canSupply
      ? (await prisma.auditLog.findMany({
          where: { action: "REVERSAL", entity: "InventoryTransaction", entityId: { in: recentTransactions.map((t) => t.id) } },
          select: { entityId: true },
        })).map((a) => a.entityId)
      : [],
  );

  const batchMap = Object.fromEntries(batches.map((b) => [b.id, b]));
  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.name]));
  const minStraws = Object.fromEntries(thresholds.map((t) => [t.unitId, t.minimumStraws]));

  const stock = grouped
    .map((g) => {
      const batch = batchMap[g.batchId];
      return {
        unitId: g.unitId,
        unitName: unitMap[g.unitId] || "",
        batchNumber: batch?.batchNumber || "",
        productName: batch?.product.name || "",
        category: batch?.product.category || "CELULAS",
        species: batch?.product.species || "",
        expirationDate: batch?.expirationDate,
        balance: g._sum.quantity || 0,
      };
    })
    .filter((s) => s.balance > 0)
    .sort((a, b) => a.unitName.localeCompare(b.unitName));

  // Um bloco por unidade: totais de cada produto e, ao abrir, os lotes
  const CATEGORY_ORDER: Record<string, number> = { CELULAS: 0, MEIO: 1, SORO: 2, MATERIAL: 3 };
  const SPECIES_ORDER: Record<string, number> = { Canino: 0, Felino: 1, Equino: 2 };
  const total = (items: typeof stock, f: (s: (typeof stock)[number]) => boolean) => items.filter(f).reduce((t, s) => t + s.balance, 0);
  const unitBlocks = units
    .map((u) => {
      const items = stock
        .filter((s) => s.unitId === u.id)
        .sort((a, b) =>
          (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9)
          || (SPECIES_ORDER[a.species ?? ""] ?? 9) - (SPECIES_ORDER[b.species ?? ""] ?? 9)
          || a.productName.localeCompare(b.productName)
          || (a.expirationDate?.getTime() ?? Infinity) - (b.expirationDate?.getTime() ?? Infinity));
      const cells = total(items, (s) => s.category === "CELULAS");
      const min = minStraws[u.id] ?? DEFAULT_MIN_STRAWS;
      return {
        ...u,
        items,
        cells,
        min,
        low: cells <= min,
        bySpecies: STANDARD_PRODUCTS.filter((p) => p.category === "CELULAS")
          .map((p) => ({ name: p.species!, value: total(items, (s) => s.category === "CELULAS" && s.species === p.species) })),
        meio: total(items, (s) => s.category === "MEIO"),
        soro: total(items, (s) => s.category === "SORO"),
        material: total(items, (s) => s.category === "MATERIAL"),
      };
    })
    .filter((u) => u.items.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const today = new Date();

  const typeLabels: Record<string, { label: string; cls: string }> = {
    RECEIPT: { label: "Recebimento", cls: "text-green-600" },
    CONSUMPTION: { label: "Consumo", cls: "text-red-600" },
    DISCARD: { label: "Descarte", cls: "text-orange-600" },
    ADJUSTMENT: { label: "Ajuste", cls: "text-blue-600" },
    TRANSFER_IN: { label: "Transferência (entrada)", cls: "text-green-600" },
    TRANSFER_OUT: { label: "Transferência (saída)", cls: "text-red-600" },
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? "Visão consolidada de todas as unidades" : "Estoque da sua unidade"}
          </p>
        </div>
        {canSupply && <Suspense><SupplyForm /></Suspense>}
      </div>

      {/* Resumo: palhetas por espécie + insumos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        {[
          ...STANDARD_PRODUCTS.filter((p) => p.category === "CELULAS").map((p) => ({
            key: p.id, label: p.name, unit: p.unit, icon: Package, color: SPECIES_COLOR[p.species!],
            value: stock.filter((s) => s.category === "CELULAS" && s.species === p.species).reduce((sum, i) => sum + i.balance, 0),
          })),
          { key: "meio", label: "MEIO", unit: "unidades", icon: Beaker, color: "#2563eb", value: stock.filter((s) => s.category === "MEIO").reduce((sum, i) => sum + i.balance, 0) },
          { key: "soro", label: "SORO", unit: "unidades", icon: Droplets, color: "#7c3aed", value: stock.filter((s) => s.category === "SORO").reduce((sum, i) => sum + i.balance, 0) },
          { key: "material", label: "MATERIAIS", unit: "unidades", icon: Syringe, color: "#64748b", value: stock.filter((s) => s.category === "MATERIAL").reduce((sum, i) => sum + i.balance, 0) },
          { key: "alertas", label: "Alertas ativos", unit: "", icon: AlertTriangle, color: "#f59e0b", value: activeAlerts },
        ].map((c) => (
          <div key={c.key} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <c.icon size={24} style={{ color: c.color }} />
              <div>
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
                {c.unit && <p className="text-xs text-gray-400">{c.unit}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 -mt-4 mb-6">
        Total de células-tronco: {stock.filter((s) => s.category === "CELULAS").reduce((sum, i) => sum + i.balance, 0)} palhetas
      </p>

      {/* Estoque por unidade: um bloco por unidade; clicando abre os lotes */}
      <div className="mb-6">
        <h2 className="font-semibold text-gray-900">Saldo por unidade</h2>
        <p className="text-xs text-gray-400 mb-3">Clique na unidade para ver os lotes.</p>
        {unitBlocks.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-sm text-gray-400">Nenhum estoque registrado</div>
        )}
        <div className="space-y-3">
          {unitBlocks.map((u) => (
            <details key={u.id} id={u.id} open={unitBlocks.length === 1 || unidade === u.id}
              className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden scroll-mt-4">
              <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-4 sm:p-5 hover:bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={18} className="text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.city}/{u.state}</p>
                  </div>
                  {u.low && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 shrink-0">
                      <AlertTriangle size={12} /> Estoque baixo
                    </span>
                  )}
                  <ChevronDown size={18} className="text-gray-400 shrink-0 transition-transform group-open:rotate-180" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <div className={`rounded-lg p-3 ${u.low ? "bg-red-50" : "bg-green-50"}`}>
                    <p className="text-xs text-gray-600 flex items-center gap-1"><Package size={13} /> Palhetas</p>
                    <p className={`text-2xl sm:text-3xl font-bold ${u.low ? "text-red-600" : "text-gray-900"}`}>{u.cells}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                      {u.bySpecies.filter((sp) => sp.value > 0).map((sp) => (
                        <span key={sp.name} className="text-xs font-medium" style={{ color: SPECIES_COLOR[sp.name] }}>{sp.name} {sp.value}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg p-3 bg-blue-50">
                    <p className="text-xs text-gray-600 flex items-center gap-1"><Beaker size={13} /> Meio</p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">{u.meio}</p>
                    <p className="text-xs text-gray-400 mt-1">unidades</p>
                  </div>
                  <div className="rounded-lg p-3 bg-purple-50">
                    <p className="text-xs text-gray-600 flex items-center gap-1"><Droplets size={13} /> Soro</p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">{u.soro}</p>
                    <p className="text-xs text-gray-400 mt-1">unidades</p>
                  </div>
                  <div className="rounded-lg p-3 bg-slate-50">
                    <p className="text-xs text-gray-600 flex items-center gap-1"><Syringe size={13} /> Materiais</p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">{u.material}</p>
                    <p className="text-xs text-gray-400 mt-1">unidades</p>
                  </div>
                </div>
              </summary>
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="w-full min-w-[520px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Produto</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Lote</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Validade</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.items.map((s) => {
                      const expired = !!s.expirationDate && s.expirationDate < today;
                      return (
                        <tr key={`${s.productName}-${s.batchNumber}`} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-2.5 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              s.category === "CELULAS" ? "bg-green-100 text-green-700" :
                              s.category === "MEIO" ? "bg-blue-100 text-blue-700" :
                              s.category === "SORO" ? "bg-purple-100 text-purple-700" :
                              "bg-slate-100 text-slate-700"
                            }`}>
                              {s.productName}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm font-mono text-gray-600">{s.batchNumber === NO_LOT ? "–" : s.batchNumber}</td>
                          <td className={`px-4 py-2.5 text-sm ${expired ? "text-red-600 font-medium" : "text-gray-600"}`}>
                            {s.expirationDate ? new Date(s.expirationDate).toLocaleDateString("pt-BR") : "–"}{expired ? " (vencido)" : ""}
                          </td>
                          <td className="px-4 py-2.5 text-sm font-bold text-right text-gray-900">
                            {s.balance} <span className="text-xs font-normal text-gray-400">{s.category === "CELULAS" ? "palhetas" : "un."}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {u.low && <p className="px-4 py-2 text-xs text-red-600 bg-red-50">Abaixo do mínimo da unidade ({u.min} palhetas).</p>}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Movimentações Recentes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Movimentações Recentes</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Data</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Tipo</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Unidade</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Produto / Lote</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Qtd</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Saldo</th>
              {canSupply && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((t) => {
              const tl = typeLabels[t.type] || { label: t.type, cls: "text-gray-600" };
              return (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${tl.cls}`}>{tl.label}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.unit.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {t.batch.product.name} {t.batch.batchNumber !== NO_LOT && <span className="text-gray-400 font-mono">{t.batch.batchNumber}</span>}
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold text-right ${t.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                    {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{t.balance}</td>
                  {canSupply && (
                    <td className="px-4 py-3 text-right">
                      {t.type === "RECEIPT" && t.quantity > 0 && (reversedIds.has(t.id)
                        ? <span className="text-xs text-gray-400">Estornado</span>
                        : <ReverseButton transactionId={t.id}
                            label={`${t.unit.name} · ${t.batch.product.name}${t.batch.batchNumber !== NO_LOT ? ` lote ${t.batch.batchNumber}` : " (sem lote)"} · +${t.quantity}`} />)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
