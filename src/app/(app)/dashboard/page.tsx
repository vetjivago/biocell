import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  Building2,
  Users,
  ClipboardList,
  Package,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

async function getDashboardData(session: { role: string; unitIds: string[] }) {
  const isAdmin = session.role === "ADMIN";
  const unitFilter = isAdmin ? {} : { unitId: { in: session.unitIds } };

  const [
    totalUnits,
    totalPatients,
    totalRecords,
    openRecords,
    lowStockAlerts,
    recentRecords,
    stockByUnit,
    pathologyStats,
  ] = await Promise.all([
    prisma.unit.count({ where: { active: true } }),
    prisma.patient.count({ where: unitFilter }),
    prisma.medicalRecord.count({ where: unitFilter }),
    prisma.medicalRecord.count({ where: { ...unitFilter, status: "OPEN" } }),
    prisma.alert.count({ where: { resolved: false, type: "LOW_STOCK" } }),
    prisma.medicalRecord.findMany({
      where: unitFilter,
      include: { patient: true, unit: true, professional: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.inventoryTransaction.groupBy({
      by: ["unitId"],
      _sum: { quantity: true },
      where: unitFilter,
    }),
    prisma.medicalRecord.groupBy({
      by: ["pathology"],
      _count: true,
      where: unitFilter,
      orderBy: { _count: { pathology: "desc" } },
      take: 8,
    }),
  ]);

  const units = await prisma.unit.findMany({
    where: { id: { in: stockByUnit.map((s) => s.unitId) } },
    select: { id: true, name: true },
  });
  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.name]));

  return {
    totalUnits,
    totalPatients,
    totalRecords,
    openRecords,
    lowStockAlerts,
    recentRecords,
    stockByUnit: stockByUnit.map((s) => ({
      unitName: unitMap[s.unitId] || s.unitId,
      totalStraws: s._sum.quantity || 0,
    })),
    pathologyStats: pathologyStats.map((p) => ({
      pathology: p.pathology,
      count: p._count,
    })),
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const data = await getDashboardData(session);

  const stats = [
    { label: "Unidades Ativas", value: data.totalUnits, icon: Building2, color: "bg-blue-500" },
    { label: "Pacientes", value: data.totalPatients, icon: Users, color: "bg-green-500" },
    { label: "Prontuários", value: data.totalRecords, icon: ClipboardList, color: "bg-purple-500" },
    { label: "Em Atendimento", value: data.openRecords, icon: TrendingUp, color: "bg-orange-500" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {session.role === "ADMIN" ? "Visão consolidada de todas as unidades" : "Visão da sua unidade"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="text-white" size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.lowStockAlerts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <AlertTriangle className="text-amber-500" size={22} />
          <div>
            <p className="font-medium text-amber-800">
              {data.lowStockAlerts} {data.lowStockAlerts === 1 ? "alerta" : "alertas"} de estoque baixo
            </p>
            <p className="text-sm text-amber-600">Verifique as unidades que precisam de reposição</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Prontuários Recentes</h2>
          {data.recentRecords.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nenhum prontuário registrado</p>
          ) : (
            <div className="space-y-3">
              {data.recentRecords.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.patient.name}</p>
                    <p className="text-xs text-gray-500">{r.pathology} – {r.unit.name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      r.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      r.status === "OPEN" ? "bg-blue-100 text-blue-700" :
                      r.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {r.status === "COMPLETED" ? "Concluído" :
                       r.status === "OPEN" ? "Aberto" :
                       r.status === "IN_PROGRESS" ? "Em andamento" : r.status}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Patologias Tratadas</h2>
          {data.pathologyStats.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nenhuma patologia registrada</p>
          ) : (
            <div className="space-y-3">
              {data.pathologyStats.map((p, i) => (
                <div key={p.pathology} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-700">{p.pathology}</span>
                      <span className="text-sm font-medium text-gray-900">{p.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-primary rounded-full h-1.5"
                        style={{ width: `${(p.count / data.pathologyStats[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {session.role === "ADMIN" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
            <h2 className="font-semibold text-gray-900 mb-4">Estoque por Unidade (palhetas)</h2>
            {data.stockByUnit.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Nenhum estoque registrado</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.stockByUnit
                  .sort((a, b) => a.totalStraws - b.totalStraws)
                  .map((s) => (
                    <div key={s.unitName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700 truncate mr-2">{s.unitName}</span>
                      <span className={`text-sm font-bold ${s.totalStraws < 10 ? "text-red-500" : "text-gray-900"}`}>
                        {s.totalStraws}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
