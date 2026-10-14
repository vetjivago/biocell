import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canEditEntry, getGeneralRecordPatient, isEntryType } from "@/lib/clinical";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import EntryForm from "../../EntryForm";
import { ENTRY_TYPES } from "@/lib/clinical-types";

export default async function EditarRegistroPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id, entryId } = await params;

  const access = await getGeneralRecordPatient(session, id);
  if ("error" in access) notFound();
  const entry = await prisma.clinicalEntry.findUnique({
    where: { id: entryId },
    include: { attachments: { select: { id: true, fileName: true, size: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!entry || entry.patientId !== id || !isEntryType(entry.type)) notFound();
  if (!canEditEntry(session, entry)) notFound();

  return (
    <div className="max-w-3xl">
      <Link href={`/pacientes/${id}/geral/${entryId}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Editar {ENTRY_TYPES[entry.type].label.toLowerCase()} – {access.patient.name}
      </h1>
      <EntryForm
        patientId={id}
        initial={{
          id: entry.id,
          type: entry.type,
          title: entry.title || "",
          content: entry.content,
          weight: entry.weight?.toString().replace(".", ",") || "",
          occurredAt: entry.occurredAt.toISOString(),
          attachments: entry.attachments,
        }}
      />
    </div>
  );
}
