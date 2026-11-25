import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { seesAllUnits } from "@/lib/roles";
import { ORDER_STATUS, RACKS, brl, canProcessPurchases, canRequestPurchases, canViewPurchases, isCellItem, orderTotals } from "@/lib/purchase-orders";
import StoreNav from "./StoreNav";

const FILTERS = [
  { key: "abertos", label: "Em aberto" },
  { key: "WAITING", label: "Aguardando" },
  { key: "INVOICED", label: "Faturados" },
  { key: "SHIPPED", label: "Enviados" },
  { key: "DELIVERED", label: "Entregues" },
  { key: "CANCELLED", label: "Cancelados" },
  { key: "todos", label: "Todos" },
];

const tz = { timeZone: "America/Sao_Paulo" } as const;

// Pedidos de compra das UABCs (antes feitos na loja do Sults)
export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ status?: string; unidade?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!canViewPurchases(session.role)) notFound();
  const { status = "abertos", unidade = "" } = await searchParams;

  const allUnits = seesAllUnits(session.role);
  const units = await prisma.unit.findMany({
    where: allUnits ? {} : { id: { in: session.unitIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const statusWhere = status === "abertos" ? { status: { in: ["WAITING", "INVOICED", "SHIPPED"] } } : status in ORDER_STATUS ? { status } : {};
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      ...statusWhere,
      ...(allUnits ? {} : { unitId: { in: session.unitIds } }),
      ...(unidade ? { unitId: unidade } : {}),
    },
    include: { unit: { select: { name: true } }, items: { select: { productId: true, quantity: true } }, lines: { select: { storeId: true, quantity: true, unitPrice: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const href = (q: { status?: string; unidade?: string }) => {
    const p = new URLSearchParams();
    const s = q.status ?? status;
    const u = q.unidade ?? unidade;
    if (s !== "abertos") p.set("status", s);
    if (u) p.set("unidade", u);
    return `/pedidos${p.size ? `?${p}` : ""}`;
  };

  // Matriz e logística veem os pedidos de todas as unidades; a unidade, os seus
  const processor = canProcessPurchases(session.role);
  return (
    <div>
      <StoreNav userId={session.id} canBuy={canRequestPurchases(session.role)} ordersLabel={processor || !canRequestPurchases(session.role) ? "Pedidos" : "Meus pedidos"} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{processor ? "Pedidos das unidades" : "Meus pedidos"}</h1>
        <p className="text-sm text-gray-500 mt-1">Ao fechar o carrinho, meios, soros e materiais das raques são calculados pelo estoque da unidade</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <Link key={f.key} href={href({ status: f.key })}
            className={`px-3 py-1.5 rounded-full text-sm border ${status === f.key ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {f.label}
          </Link>
        ))}
        {units.length > 1 && (
          <form className="ml-auto">
            {status !== "abertos" && <input type="hidden" name="status" value={status} />}
            <select name="unidade" defaultValue={unidade} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
              <option value="">Todas as unidades</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="ml-2 text-sm text-primary hover:underline">Filtrar</button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full min-w-[760px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nº</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Data</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Unidade</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Células</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Valor</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.WAITING;
              const straws = o.items.filter((i) => isCellItem(i.productId)).reduce((s, i) => s + i.quantity, 0);
              const racks = RACKS.filter((r) => o[r.key] > 0).map((r) => `${o[r.key]} ${r.label.toLowerCase()}`).join(" · ");
              return (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3"><Link href={`/pedidos/${o.id}`} className="text-sm font-medium text-primary hover:underline">#{o.number}</Link></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{o.createdAt.toLocaleDateString("pt-BR", tz)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{o.unit.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{straws ? `${straws} palhetas${racks ? ` (raques: ${racks})` : ""}` : "Só materiais"}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{brl(orderTotals(o).total)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Nenhum pedido encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
