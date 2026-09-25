import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function ProntuariosPage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = session.role === "ADMIN";
  const records = await prisma.medicalRecord.findMany({
    where: isAdmin ? {} : { unitId: { in: session.unitIds } },
    include: {
      patient: true,
      unit: { select: { name: true } },
      professional: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const statusConfig: Record<string, { label: string; cls: string }> = {
    OPEN: { label: "Aberto", cls: "bg-blue-100 text-blue-700" },
    IN_PROGRESS: { label: "Em andamento", cls: "bg-yellow-100 text-yellow-700" },
    COMPLETED: { label: "Concluído", cls: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-700" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prontuários</h1>
          <p className="text-sm text-gray-500 mt-1">{records.length} prontuários</p>
        </div>
        <Link
          href="/prontuarios/novo"
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Novo Prontuário
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nº Série</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Paciente</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Patologia</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Unidade</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Profissional</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const st = statusConfig[r.status] || statusConfig.OPEN;
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/prontuarios/${r.id}`} className="text-sm font-mono text-primary hover:underline">
                      {r.serialNumber.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{r.patient.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.pathology}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.unit.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.professional.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                  Nenhum prontuário encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
