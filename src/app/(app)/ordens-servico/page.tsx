import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { ORDER_STATUS, orderStatus, serviceOrderUnitIds } from "@/lib/service-orders";

const FILTERS = [
  { key: "pendentes", label: "Pendentes" },
  { key: "OPEN", label: "Aguardando preparo" },
  { key: "IN_PREP", label: "Em preparo" },
  { key: "DONE", label: "Concluídas" },
  { key: "todas", label: "Todas" },
];

// Fila de ordens de serviço para quem prepara as células
export default async function OrdensServicoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { status = "pendentes" } = await searchParams;

  const unitIds = await serviceOrderUnitIds(session);
  const orders = unitIds.length === 0 ? [] : await prisma.serviceOrder.findMany({
    where: { unitId: { in: unitIds } },
    include: {
      patient: { select: { id: true, name: true, species: true, ownerName: true } },
      unit: { select: { name: true } },
      applications: { orderBy: { number: "asc" }, select: { number: true, status: true, date: true, veterinarian: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const rows = orders
    .map((o) => ({ ...o, st: orderStatus(o) }))
    .filter((o) => status === "todas" || (status === "pendentes" ? o.st === "OPEN" || o.st === "IN_PREP" : o.st === status));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ordens de serviço</h1>
        <p className="text-sm text-gray-500 mt-1">Preparo das células. Para abrir uma OS, acesse o paciente (aba Células-tronco).</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/ordens-servico?status=${f.key}`}
            className={`px-3 py-1.5 rounded-full text-sm border ${status === f.key ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200"}`}>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nº Série</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Paciente</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Aplicação pendente</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const pending = o.applications.find((a) => a.status !== "DONE");
              const st = ORDER_STATUS[o.st];
              return (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/ordens-servico/${o.id}`} className="text-sm font-mono text-primary hover:underline">{o.serialNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-900">{o.patient.name}</span>
                    <span className="text-gray-500"> · {o.patient.species} · {o.patient.ownerName}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {pending
                      ? `${pending.number}ª${pending.date ? ` · ${pending.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}${pending.veterinarian ? ` · ${pending.veterinarian}` : ""}`
                      : `${o.applications.length} aplicação(ões) concluída(s)`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">
                  {unitIds.length === 0 ? "Ordem de serviço não habilitada para suas unidades" : "Nenhuma ordem de serviço"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
