import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Package, AlertTriangle } from "lucide-react";

export default async function EstoquePage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = session.role === "ADMIN";
  const unitFilter = isAdmin ? {} : { unitId: { in: session.unitIds } };

  const grouped = await prisma.inventoryTransaction.groupBy({
    by: ["unitId", "batchId"],
    _sum: { quantity: true },
    where: unitFilter,
  });

  const batchIds = [...new Set(grouped.map((g) => g.batchId))];
  const unitIds = [...new Set(grouped.map((g) => g.unitId))];

  const [batches, units, thresholds, recentTransactions] = await Promise.all([
    prisma.cellBatch.findMany({
      where: { id: { in: batchIds } },
      include: { product: { select: { name: true, code: true, species: true } } },
    }),
    prisma.unit.findMany({ where: { id: { in: unitIds } }, select: { id: true, name: true } }),
    prisma.stockThreshold.findMany({ where: unitFilter }),
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

  const batchMap = Object.fromEntries(batches.map((b) => [b.id, b]));
  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.name]));

  const stock = grouped
    .map((g) => {
      const batch = batchMap[g.batchId];
      return {
        unitId: g.unitId,
        unitName: unitMap[g.unitId] || "",
        batchNumber: batch?.batchNumber || "",
        productName: batch?.product.name || "",
        species: batch?.product.species || "",
        expirationDate: batch?.expirationDate,
        balance: g._sum.quantity || 0,
      };
    })
    .filter((s) => s.balance > 0)
    .sort((a, b) => a.unitName.localeCompare(b.unitName));

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Estoque de Células</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdmin ? "Visão consolidada de todas as unidades" : "Estoque da sua unidade"}
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <Package className="text-primary" size={24} />
            <div>
              <p className="text-sm text-gray-500">Total de Palhetas</p>
              <p className="text-2xl font-bold">{stock.reduce((s, i) => s + i.balance, 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <Package className="text-blue-500" size={24} />
            <div>
              <p className="text-sm text-gray-500">Lotes Ativos</p>
              <p className="text-2xl font-bold">{new Set(stock.map((s) => s.batchNumber)).size}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-500" size={24} />
            <div>
              <p className="text-sm text-gray-500">Alertas Ativos</p>
              <p className="text-2xl font-bold">{thresholds.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estoque por Unidade/Lote */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Saldo por Unidade e Lote</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Unidade</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Produto</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Lote</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Espécie</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Validade</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.unitName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.productName}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{s.batchNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.species}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {s.expirationDate ? new Date(s.expirationDate).toLocaleDateString("pt-BR") : "–"}
                </td>
                <td className={`px-4 py-3 text-sm font-bold text-right ${s.balance < 10 ? "text-red-500" : "text-gray-900"}`}>
                  {s.balance}
                </td>
              </tr>
            ))}
            {stock.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Nenhum estoque registrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Movimentações Recentes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Movimentações Recentes</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Data</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Tipo</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Unidade</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Produto / Lote</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Qtd</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Saldo</th>
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
                    {t.batch.product.name} <span className="text-gray-400 font-mono">{t.batch.batchNumber}</span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold text-right ${t.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                    {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{t.balance}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
