import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default async function PacienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      unit: { select: { name: true } },
      medicalRecords: {
        include: { professional: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!patient) notFound();

  const statusConfig: Record<string, { label: string; cls: string }> = {
    OPEN: { label: "Aberto", cls: "bg-blue-100 text-blue-700" },
    IN_PROGRESS: { label: "Em andamento", cls: "bg-yellow-100 text-yellow-700" },
    COMPLETED: { label: "Concluído", cls: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-700" },
  };

  return (
    <div className="max-w-3xl">
      <Link href="/pacientes" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
          <Link href="/prontuarios/novo" className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-3 py-2 rounded-lg text-sm font-medium">
            <Plus size={14} /> Novo Prontuário
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500">Espécie</p><p className="font-medium">{patient.species}</p></div>
          <div><p className="text-gray-500">Raça</p><p className="font-medium">{patient.breed || "–"}</p></div>
          <div><p className="text-gray-500">Peso</p><p className="font-medium">{patient.weight ? `${patient.weight} kg` : "–"}</p></div>
          <div><p className="text-gray-500">Unidade</p><p className="font-medium">{patient.unit.name}</p></div>
          <div><p className="text-gray-500">Responsável</p><p className="font-medium">{patient.ownerName}</p></div>
          <div><p className="text-gray-500">Telefone</p><p className="font-medium">{patient.ownerPhone || "–"}</p></div>
          <div><p className="text-gray-500">Veterinário</p><p className="font-medium">{patient.veterinarian || "–"}</p></div>
          <div><p className="text-gray-500">Clínica</p><p className="font-medium">{patient.clinic || "–"}</p></div>
        </div>
      </div>

      <h2 className="font-semibold text-gray-900 mb-3">Prontuários ({patient.medicalRecords.length})</h2>
      <div className="space-y-3">
        {patient.medicalRecords.map((r) => {
          const st = statusConfig[r.status] || statusConfig.OPEN;
          return (
            <Link key={r.id} href={`/prontuarios/${r.id}`} className="block bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{r.pathology}</p>
                  <p className="text-sm text-gray-500">Dr(a). {r.professional.name} • {new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
              </div>
            </Link>
          );
        })}
        {patient.medicalRecords.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum prontuário registrado</p>
        )}
      </div>
    </div>
  );
}
