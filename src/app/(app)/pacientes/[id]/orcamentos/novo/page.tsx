import { getSession } from "@/lib/auth";
import { getGeneralRecordPatient } from "@/lib/clinical";
import { defaultValidUntil } from "@/lib/sales-types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SaleForm from "../SaleForm";

export default async function NovoOrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const access = await getGeneralRecordPatient(session, id);
  if ("error" in access) notFound();
  const p = access.patient;
  const validUntil = defaultValidUntil();

  return (
    <div className="max-w-4xl">
      <Link href={`/pacientes/${id}?aba=financeiro`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> {p.name}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Novo orçamento</h1>
      <p className="text-sm text-gray-500 mb-6">
        {p.name} · {p.species}{p.breed ? ` · ${p.breed}` : ""} · Tutor: {p.ownerName}
      </p>
      <SaleForm patientId={id} initial={{ items: [], validUntil, notes: "", discount: 0 }} />
    </div>
  );
}
