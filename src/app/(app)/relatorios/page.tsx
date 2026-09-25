import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export default async function RelatoriosPage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = session.role === "ADMIN";
  const unitFilter = isAdmin ? {} : { unitId: { in: session.unitIds } };

  const [totalPatients, totalRecords, completedRecords, totalConsumption, pathologies, unitStats] = await Promise.all([
    prisma.patient.count({ where: unitFilter }),
    prisma.medicalRecord.count({ where: unitFilter }),
    prisma.medicalRecord.count({ where: { ...unitFilter, status: "COMPLETED" } }),
    prisma.inventoryTransaction.aggregate({
      where: { ...unitFilter, type: "CONSUMPTION" },
      _sum: { quantity: true },
    }),
    prisma.medicalRecord.groupBy({
      by: ["pathology"],
      _count: true,
      where: unitFilter,
      orderBy: { _count: { pathology: "desc" } },
      take: 15,
    }),
    isAdmin ? prisma.medicalRecord.groupBy({
      by: ["unitId"],
      _count: true,
      where: unitFilter,
    }) : Promise.resolve([]),
  ]);

  const unitIds = Array.isArray(unitStats) ? unitStats.map((u) => u.unitId) : [];
  const units = unitIds.length ? await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    select: { id: true, name: true },
  }) : [];
  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.name]));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Relatórios</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Pacientes</p>
          <p className="text-3xl font-bold mt-1">{totalPatients}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Atendimentos</p>
          <p className="text-3xl font-bold mt-1">{totalRecords}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Atendimentos Concluídos</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{completedRecords}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Palhetas Consumidas</p>
          <p className="text-3xl font-bold mt-1 text-red-600">{Math.abs(totalConsumption._sum.quantity || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Ranking de Patologias</h2>
          <div className="space-y-3">
            {pathologies.map((p, i) => (
              <div key={p.pathology} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-6">{i + 1}.</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-700">{p.pathology}</span>
                    <span className="text-sm font-bold text-gray-900">{p._count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-primary rounded-full h-2"
                      style={{ width: `${(p._count / pathologies[0]._count) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {pathologies.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sem dados</p>}
          </div>
        </div>

        {isAdmin && Array.isArray(unitStats) && unitStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Atendimentos por Unidade</h2>
            <div className="space-y-3">
              {(unitStats as { unitId: string; _count: number }[])
                .sort((a, b) => b._count - a._count)
                .map((u) => (
                  <div key={u.unitId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{unitMap[u.unitId] || u.unitId}</span>
                    <span className="text-sm font-bold text-gray-900">{u._count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
