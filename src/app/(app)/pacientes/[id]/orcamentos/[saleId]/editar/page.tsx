import { getSession } from "@/lib/auth";
import { getGeneralRecordPatient } from "@/lib/clinical";
import { getAccessibleSale, saleNumber } from "@/lib/sales";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SaleForm from "../../SaleForm";

export default async function EditarOrcamentoPage({ params }: { params: Promise<{ id: string; saleId: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id, saleId } = await params;

  const access = await getGeneralRecordPatient(session, id);
  if ("error" in access) notFound();
  const saleAccess = await getAccessibleSale(session, saleId);
  if ("error" in saleAccess || saleAccess.sale.patientId !== id) notFound();
  const { sale } = saleAccess;
  // Itens de venda não mudam; cancelado precisa ser reaberto
  if (sale.status !== "QUOTE") redirect(`/pacientes/${id}/orcamentos/${saleId}`);
  const p = access.patient;

  return (
    <div className="max-w-4xl">
      <Link href={`/pacientes/${id}/orcamentos/${saleId}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Orçamento Nº {saleNumber(sale.number)}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Editar orçamento Nº {saleNumber(sale.number)}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {p.name} · {p.species}{p.breed ? ` · ${p.breed}` : ""} · Tutor: {p.ownerName}
      </p>
      <SaleForm
        patientId={id}
        saleId={saleId}
        initial={{
          items: sale.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
          validUntil: sale.validUntil ? sale.validUntil.toISOString().slice(0, 10) : "",
          notes: sale.notes || "",
          discount: sale.discount,
        }}
      />
    </div>
  );
}
