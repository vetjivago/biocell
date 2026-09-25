import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { q } = await searchParams;

  const isAdmin = session.role === "ADMIN";
  const where = {
    ...(isAdmin ? {} : { unitId: { in: session.unitIds } }),
    ...(q ? { name: { contains: q } } : {}),
  };

  const patients = await prisma.patient.findMany({
    where,
    include: { unit: { select: { name: true } }, _count: { select: { medicalRecords: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-1">{patients.length} pacientes encontrados</p>
        </div>
        <Link
          href="/pacientes/novo"
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Novo Paciente
        </Link>
      </div>

      <form className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome do animal..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Animal</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Espécie/Raça</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Responsável</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Unidade</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Prontuários</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Peso</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/pacientes/${p.id}`} className="text-sm font-medium text-primary hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.species}{p.breed ? ` – ${p.breed}` : ""}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.ownerName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.unit.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p._count.medicalRecords}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.weight ? `${p.weight} kg` : "–"}</td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  Nenhum paciente encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
