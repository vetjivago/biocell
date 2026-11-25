import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { standardProduct } from "@/lib/products";
import { ORDER_STATUS, RACKS, brl, canProcessPurchases, canRequestPurchases, isCellItem, orderTotals, parseLots } from "@/lib/purchase-orders";
import { getAccessiblePurchaseOrder } from "@/lib/purchase-orders-server";
import PrintButton from "../../pacientes/[id]/geral/PrintButton";
import StoreNav from "../StoreNav";
import { PurchaseEditor, UnitActions } from "./PurchaseActions";

const tz = { timeZone: "America/Sao_Paulo" } as const;
const day = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR", tz) : "");

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden break-inside-avoid">
      <p className="bg-primary/10 text-primary text-xs font-bold uppercase tracking-wide px-3 py-1.5">{title}</p>
      <div className="px-3 py-2 text-sm">{children}</div>
    </div>
  );
}

// Pedido no formato da OS de reposição da UABC (imprimível); administrativo e logística ajustam e dão andamento logo abaixo
export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const access = await getAccessiblePurchaseOrder(session, id);
  if ("error" in access) notFound();
  const { order } = access;
  const unit = await prisma.unit.findUnique({ where: { id: order.unitId }, select: { name: true, city: true, state: true } });

  const st = ORDER_STATUS[order.status] ?? ORDER_STATUS.WAITING;
  const totals = orderTotals(order);
  const admin = canProcessPurchases(session.role);
  const editable = admin && ["WAITING", "INVOICED"].includes(order.status);
  const own = session.unitIds.includes(order.unitId);
  const racksOf = (productId: string) => RACKS.find((r) => r.productId === productId);
  const steps = [
    ["Pedido", order.createdAt],
    ["Faturado", order.invoicedAt],
    ["Enviado", order.shippedAt],
    ["Entregue", order.deliveredAt],
  ] as const;

  return (
    <div className="max-w-4xl">
      <StoreNav userId={session.id} canBuy={canRequestPurchases(session.role)} ordersLabel={admin || !canRequestPurchases(session.role) ? "Pedidos" : "Meus pedidos"} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <Link href="/pedidos" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Pedidos de compra
        </Link>
        <div className="flex items-center gap-2">
          <UnitActions orderId={order.id} canCancel={order.status === "WAITING" && own && !admin} canDeliver={order.status === "SHIPPED" && (own || admin)} />
          <PrintButton />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Ordem de serviço · Reposição UABC</p>
            <h1 className="text-xl font-bold text-gray-900">Pedido nº {order.number}</h1>
            <p className="text-sm text-gray-700">{unit?.name}{unit ? ` — ${unit.city}/${unit.state}` : ""}</p>
            <p className="text-xs text-gray-500">Solicitante: {order.createdByName}</p>
          </div>
          <div className="text-right">
            <span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
            <div className="text-xs text-gray-500 mt-2 space-y-0.5">
              {steps.filter(([, d]) => d).map(([l, d]) => <p key={l}>{l}: {day(d)}</p>)}
              {order.cancelledAt && <p>Cancelado: {day(order.cancelledAt)}</p>}
            </div>
          </div>
        </div>

        {order.lines.length > 0 && (
          <div className="mb-5 break-inside-avoid">
            <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">Itens comprados na loja</p>
            <table className="w-full text-sm">
              <tbody>
                {order.lines.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2">{l.name}</td>
                    <td className="py-1.5 px-2 text-right text-gray-500 whitespace-nowrap">{l.quantity} × {brl(l.unitPrice)}</td>
                    <td className="py-1.5 pl-2 text-right font-medium whitespace-nowrap">{brl(l.quantity * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">Reposição UABC — o que vai na caixa</p>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="text-left py-2 pr-2">Item</th>
              <th className="text-left py-2 pr-2">Apresentação</th>
              <th className="text-right py-2 px-2">Em estoque</th>
              <th className="text-right py-2 px-2">Calculado</th>
              <th className="text-right py-2 px-2">Extra</th>
              <th className="text-right py-2 pl-2">Total a enviar</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => {
              const p = standardProduct(it.productId);
              const rack = racksOf(it.productId);
              const lots = parseLots(it.lots).filter((l) => l.batchNumber);
              return (
                <tr key={it.id} className={`border-b border-gray-100 break-inside-avoid ${it.quantity > 0 ? "" : "text-gray-400"}`}>
                  <td className="py-1.5 pr-2">
                    {p?.name ?? it.productId}
                    {lots.length > 0 && <span className="block text-xs text-gray-500">Lote: {lots.map((l) => `${l.batchNumber} (${l.quantity})`).join(", ")}</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-gray-500">{p?.presentation}</td>
                  <td className="py-1.5 px-2 text-right">{it.stockQty}</td>
                  <td className="py-1.5 px-2 text-right">{rack ? `${order[rack.key]} raque(s)` : it.calculated}</td>
                  <td className="py-1.5 px-2 text-right">{it.extra || ""}</td>
                  <td className="py-1.5 pl-2 text-right font-medium">{it.quantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Box title="Logística">
            <p>Envio: {order.shippingMode || "—"}{order.carrier ? ` · ${order.carrier}` : ""}</p>
            <p>Gelo seco: {order.dryIce ? `sim (${order.dryIceQty}) · ${brl(totals.dryIce)}` : "não"}</p>
            <p>Frete: {brl(order.freight)}</p>
          </Box>
          <Box title="Financeiro">
            <p>Células: {brl(totals.cells)} ({order.items.filter((i) => isCellItem(i.productId)).reduce((s, i) => s + i.quantity, 0)} palhetas)</p>
            {totals.cart > 0 && <p>Outros itens da loja: {brl(totals.cart)}</p>}
            {totals.box > 0 && <p>Caixa de isopor: {brl(totals.box)}</p>}
            {totals.ringer > 0 && <p>Ringer: {brl(totals.ringer)}</p>}
            {totals.equipo > 0 && <p>Equipo: {brl(totals.equipo)}</p>}
            {order.extraValue > 0 && <p>Extra: {brl(order.extraValue)}</p>}
            {order.discount > 0 && <p>Desconto: −{brl(order.discount)}</p>}
            <p className="font-bold mt-1">Valor total: {brl(totals.total)}</p>
            <p className="text-gray-600">Pagamento: {order.paymentMethod || "—"}{order.installments ? ` · ${order.installments}` : ""}</p>
          </Box>
        </div>

        {(order.notes || order.adminNotes) && (
          <div className="mt-3">
            <Box title="Observações">
              {order.notes && <p className="whitespace-pre-line"><span className="text-gray-500">Unidade:</span> {order.notes}</p>}
              {order.adminNotes && <p className="whitespace-pre-line"><span className="text-gray-500">Atendimento:</span> {order.adminNotes}</p>}
            </Box>
          </div>
        )}
        {order.shippedBy && <p className="text-xs text-gray-500 mt-3">Enviado por {order.shippedBy}: os itens entraram no estoque da unidade.</p>}
      </div>

      {editable && (
        <div className="mt-6 print:hidden">
          <PurchaseEditor
            order={{
              id: order.id, status: order.status, dryIce: order.dryIce, dryIceQty: order.dryIceQty, shippingMode: order.shippingMode ?? "",
              carrier: order.carrier ?? "", freight: order.freight, extraValue: order.extraValue, discount: order.discount,
              paymentMethod: order.paymentMethod ?? "", installments: order.installments ?? "", adminNotes: order.adminNotes ?? "",
            }}
            items={order.items.map((it) => ({ id: it.id, productId: it.productId, calculated: it.calculated, quantity: it.quantity, lots: parseLots(it.lots) }))}
            lines={order.lines.map((l) => ({ storeId: l.storeId, quantity: l.quantity, unitPrice: l.unitPrice }))}
          />
        </div>
      )}
    </div>
  );
}
