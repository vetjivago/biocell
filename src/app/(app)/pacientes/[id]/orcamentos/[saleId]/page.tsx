import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SALE_STATUS, canManageSale, formatBRL, getAccessibleSale, paymentLabel, saleNumber, saleTotals } from "@/lib/sales";
import { formatAge } from "@/lib/patient-fields";
import SaleActions from "./SaleActions";

const TZ = "America/Sao_Paulo";
// Validade e data da venda são só dia (gravadas à meia-noite UTC)
const dayUTC = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "");
const dayInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function OrcamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; saleId: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id, saleId } = await params;
  const { doc } = await searchParams;

  const access = await getAccessibleSale(session, saleId);
  if ("error" in access || access.sale.patientId !== id) notFound();

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      patient: true,
      unit: true,
      createdBy: { select: { name: true } },
      soldBy: { select: { name: true } },
      items: { orderBy: { position: "asc" } },
    },
  });
  if (!sale) notFound();

  const p = sale.patient;
  const st = SALE_STATUS[sale.status] || SALE_STATUS.QUOTE;
  const { subtotal, discount, total } = saleTotals(sale);
  const isSale = !!sale.soldAt;
  // Venda: documento para o financeiro (padrão) ou o orçamento original
  const financeDoc = isSale && doc !== "orcamento";
  const num = saleNumber(sale.number);
  const title = financeDoc ? `Venda Nº ${num}` : `Orçamento Nº ${num}`;
  const expired = sale.status === "QUOTE" && sale.validUntil && sale.validUntil < new Date(new Date().toLocaleDateString("en-CA", { timeZone: TZ }));
  const perInstallment = sale.installments && sale.installments > 1 ? Math.round(total / sale.installments) : null;
  const issuedAt = new Date().toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
  const age = formatAge(p.birthDate);

  // Texto do e-mail para o financeiro
  const summary = [
    `${title} – ${sale.unit.name}`,
    "",
    `Tutor: ${p.ownerName}${p.ownerPhone ? ` · ${p.ownerPhone}` : ""}`,
    `Paciente: ${p.name} (${[p.species, p.breed].filter(Boolean).join(", ")})`,
    "",
    "Referente a:",
    ...sale.items.map((i) => `- ${i.quantity} x ${i.description} – ${formatBRL(i.unitPrice)} = ${formatBRL(i.quantity * i.unitPrice)}`),
    "",
    ...(discount ? [`Subtotal: ${formatBRL(subtotal)}`, `Desconto: ${formatBRL(discount)}`] : []),
    `Valor total: ${formatBRL(total)}`,
    ...(isSale
      ? [
          `Forma de pagamento: ${paymentLabel(sale.paymentMethod, sale.installments)}${perInstallment ? ` de ${formatBRL(perInstallment)}` : ""}`,
          `Data da venda: ${dayUTC(sale.soldAt)}`,
          ...(sale.paymentNotes ? [`Obs. do pagamento: ${sale.paymentNotes}`] : []),
        ]
      : sale.validUntil ? [`Validade: ${dayUTC(sale.validUntil)}`] : []),
    ...(sale.notes ? ["", `Observações: ${sale.notes}`] : []),
    "",
    `Responsável: ${(isSale ? sale.soldBy?.name : null) || sale.createdBy.name}`,
  ].join("\n");

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <Link href={`/pacientes/${id}?aba=financeiro`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> {p.name}
        </Link>
        <span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}{expired ? " · vencido" : ""}</span>
      </div>

      <SaleActions
        sale={{
          id: sale.id, patientId: id, status: sale.status, isSale,
          paymentMethod: sale.paymentMethod || "", installments: sale.installments || 1, paymentNotes: sale.paymentNotes || "",
          soldAt: dayInput(sale.soldAt), notes: sale.notes || "", total,
        }}
        canManage={canManageSale(session, sale)}
        financeDoc={financeDoc}
        mail={{ subject: `${title} – ${p.name} (${p.ownerName})`, body: summary }}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 print:shadow-none print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4 border border-gray-200 rounded p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="BIO CELL by VETNIL" className="h-16 w-auto" />
          <div className="text-right text-xs text-gray-600">
            <p className="text-sm font-bold text-gray-800">BIO CELL</p>
            <p>{sale.unit.name}</p>
            {sale.unit.address && <p>{sale.unit.address}</p>}
            <p>{sale.unit.city}/{sale.unit.state}{sale.unit.phone ? ` · ${sale.unit.phone}` : ""}</p>
          </div>
        </div>
        <div className="border border-gray-200 rounded p-2 mt-2 text-center">
          <p className="text-sm font-semibold text-gray-800">{financeDoc ? "Comunicado de venda ao financeiro" : "Orçamento"} · Nº {num}</p>
          {sale.status === "CANCELLED" && <p className="text-xs font-semibold text-red-600 uppercase">Cancelado</p>}
        </div>

        <div className="border border-gray-200 rounded p-3 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="font-semibold text-gray-700">Tutor: </span>{p.ownerName}</p>
          <p><span className="font-semibold text-gray-700">Telefone: </span>{p.ownerPhone || "-"}</p>
          <p><span className="font-semibold text-gray-700">CPF: </span>{p.ownerCpf || "-"}</p>
          {p.ownerEmail && <p><span className="font-semibold text-gray-700">E-mail: </span>{p.ownerEmail}</p>}
          <p className="sm:col-span-2"><span className="font-semibold text-gray-700">Endereço: </span>{p.ownerAddress || "-"}</p>
          <p><span className="font-semibold text-gray-700">Paciente: </span>{p.name}</p>
          <p><span className="font-semibold text-gray-700">Espécie/raça: </span>{[p.species, p.breed].filter(Boolean).join(", ")}</p>
          {(age || p.weight) && (
            <p className="sm:col-span-2"><span className="font-semibold text-gray-700">Idade/peso: </span>{[age, p.weight ? `${p.weight.toLocaleString("pt-BR")} kg` : ""].filter(Boolean).join(" · ")}</p>
          )}
          <p><span className="font-semibold text-gray-700">{financeDoc ? "Data da venda" : "Data"}: </span>
            {financeDoc ? dayUTC(sale.soldAt) : sale.createdAt.toLocaleDateString("pt-BR", { timeZone: TZ })}
          </p>
          {!financeDoc && sale.validUntil && (
            <p><span className="font-semibold text-gray-700">Validade: </span>{dayUTC(sale.validUntil)}{expired ? " (vencido)" : ""}</p>
          )}
        </div>

        <h2 className="mt-6 mb-2 text-sm font-bold text-gray-700 uppercase">Referente a</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-600">
              <th className="py-2 font-semibold">Descrição</th>
              <th className="py-2 font-semibold text-center w-14">Qtd.</th>
              <th className="py-2 font-semibold text-right w-28">Valor unit.</th>
              <th className="py-2 font-semibold text-right w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.id} className="border-b border-gray-100 break-inside-avoid">
                <td className="py-2 text-gray-900">{i.description}</td>
                <td className="py-2 text-center">{i.quantity}</td>
                <td className="py-2 text-right whitespace-nowrap">{formatBRL(i.unitPrice)}</td>
                <td className="py-2 text-right whitespace-nowrap">{formatBRL(i.quantity * i.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {discount > 0 && (
              <>
                <tr><td colSpan={3} className="pt-3 text-right text-gray-600">Subtotal</td><td className="pt-3 text-right whitespace-nowrap">{formatBRL(subtotal)}</td></tr>
                <tr><td colSpan={3} className="text-right text-gray-600">Desconto</td><td className="text-right whitespace-nowrap">− {formatBRL(discount)}</td></tr>
              </>
            )}
            <tr>
              <td colSpan={3} className="pt-2 text-right font-bold text-gray-900">Valor total</td>
              <td className="pt-2 text-right font-bold text-gray-900 text-base whitespace-nowrap">{formatBRL(total)}</td>
            </tr>
          </tfoot>
        </table>

        {financeDoc && (
          <div className="mt-6 border border-gray-200 rounded p-3 text-sm space-y-1 break-inside-avoid">
            <h2 className="text-sm font-bold text-gray-700 uppercase mb-1">Pagamento</h2>
            <p><span className="font-semibold text-gray-700">Forma de pagamento: </span>{paymentLabel(sale.paymentMethod, sale.installments)}
              {perInstallment ? ` de ${formatBRL(perInstallment)}` : ""}</p>
            <p><span className="font-semibold text-gray-700">Valor: </span>{formatBRL(total)}</p>
            {sale.paymentNotes && <p className="whitespace-pre-line"><span className="font-semibold text-gray-700">Observações do pagamento: </span>{sale.paymentNotes}</p>}
          </div>
        )}

        {sale.notes && (
          <div className="mt-4 text-sm break-inside-avoid">
            <h2 className="text-sm font-bold text-gray-700 uppercase mb-1">Observações</h2>
            <p className="text-gray-800 whitespace-pre-line">{sale.notes}</p>
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs text-gray-600 break-inside-avoid">
          <div>
            <div className="border-t border-gray-400 pt-1 text-center">
              {(financeDoc ? sale.soldBy?.name : null) || sale.createdBy.name}
              <br />Responsável
            </div>
          </div>
          {financeDoc && (
            <div>
              <div className="border-t border-gray-400 pt-1 text-center">Financeiro<br />Recebido em ___/___/______</div>
            </div>
          )}
        </div>
        <p className="mt-6 text-[11px] text-gray-400 text-right">Emitido em {issuedAt}</p>
      </div>
    </div>
  );
}
