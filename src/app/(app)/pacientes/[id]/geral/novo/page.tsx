import { getSession } from "@/lib/auth";
import { getGeneralRecordPatient, isEntryType } from "@/lib/clinical";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import EntryForm from "../EntryForm";
import { ENTRY_TYPES } from "@/lib/clinical-types";

export default async function NovoRegistroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const { tipo } = await searchParams;

  const access = await getGeneralRecordPatient(session, id);
  if ("error" in access) notFound();
  const type = isEntryType(tipo) ? tipo : "ATENDIMENTO";
  const p = access.patient;

  return (
    <div className="max-w-3xl">
      <Link href={`/pacientes/${id}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> {p.name}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{ENTRY_TYPES[type].label}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {p.name} · {p.species}{p.breed ? ` · ${p.breed}` : ""} · Tutor: {p.ownerName}
      </p>
      <EntryForm patientId={id} initial={{ type, title: "", content: "", weight: "", occurredAt: null }} />
    </div>
  );
}
