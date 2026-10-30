import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Search, ScanSearch } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { seesAllUnits } from "@/lib/roles";
import { canTraceBatches } from "@/lib/batch-trace";
import { NO_LOT } from "@/lib/products";

const CATEGORY_CLS: Record<string, string> = {
  CELULAS: "bg-green-100 text-green-700",
  MEIO: "bg-blue-100 text-blue-700",
  SORO: "bg-purple-100 text-purple-700",
};

// Busca de lote para rastreabilidade e recall
export default async function RastreabilidadePage({ searchParams }: { searchParams: Promise<{ lote?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!canTraceBatches(session.role)) notFound();

  const q = ((await searchParams).lote ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const allUnits = seesAllUnits(session.role);

  const batches = await prisma.cellBatch.findMany({
    where: {
      batchNumber: q ? { contains: q, mode: "insensitive", not: NO_LOT } : { not: NO_LOT },
      ...(allUnits ? {} : { inventoryTransactions: { some: { unitId: { in: session.unitIds } } } }),
    },
    include: { product: { select: { name: true, category: true } } },
    orderBy: { createdAt: "desc" },
    take: q ? 50 : 20,
  });

  // Número digitado exatamente igual a um único lote: vai direto para ele
  const exact = batches.filter((b) => b.batchNumber.toLowerCase() === q.toLowerCase());
  if (q && exact.length === 1) redirect(`/rastreabilidade/${exact[0].id}`);

  const ids = batches.map((b) => b.id);
  const [balances, uses] = ids.length
    ? await Promise.all([
        prisma.inventoryTransaction.groupBy({
          by: ["batchId", "unitId"],
          _sum: { quantity: true },
          where: { batchId: { in: ids }, ...(allUnits ? {} : { unitId: { in: session.unitIds } }) },
        }),
        prisma.applicationItem.groupBy({
          by: ["batchId"],
          _count: true,
          where: { batchId: { in: ids }, ...(allUnits ? {} : { application: { medicalRecord: { unitId: { in: session.unitIds } } } }) },
        }),
      ])
    : [[], []];
  const info = (id: string) => {
    const rows = balances.filter((b) => b.batchId === id);
    return {
      units: rows.length,
      balance: rows.reduce((s, r) => s + (r._sum.quantity || 0), 0),
      uses: uses.find((u) => u.batchId === id)?._count ?? 0,
    };
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Rastreabilidade de lotes</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Consulte um lote para ver o recebimento, as unidades que o receberam, o saldo restante e os prontuários em que foi usado.
        Em caso de problema com o lote, use a consulta para localizar as unidades e os pacientes potencialmente afetados.
      </p>

      <form className="flex gap-2 mb-6" action="/rastreabilidade">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input name="lote" defaultValue={q} autoFocus placeholder="Número do lote (ex.: 05.004.25 LT 021225.1)"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90">Consultar</button>
      </form>

      <h2 className="font-semibold text-gray-900 mb-3">{q ? `Lotes encontrados para "${q}"` : "Lotes cadastrados recentemente"}</h2>
      {batches.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-sm text-gray-400">
          <ScanSearch size={28} className="mx-auto mb-2 text-gray-300" />
          Nenhum lote encontrado
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[640px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Lote</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Produto</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Validade</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Unidades</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Usos em aplicações</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const i = info(b.id);
                return (
                  <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/rastreabilidade/${b.id}`} className="text-sm font-mono text-primary hover:underline">{b.batchNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_CLS[b.product.category] ?? "bg-slate-100 text-slate-700"}`}>{b.product.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.expirationDate ? b.expirationDate.toLocaleDateString("pt-BR") : "–"}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{i.units}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{i.uses}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{i.balance}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
