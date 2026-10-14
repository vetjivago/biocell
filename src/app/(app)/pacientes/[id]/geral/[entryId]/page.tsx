import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canEditEntry, getGeneralRecordPatient, isEntryType } from "@/lib/clinical";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileText, ImageIcon, Pencil } from "lucide-react";
import { ENTRY_TYPES } from "@/lib/clinical-types";
import PrintButton from "../PrintButton";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const tz = { timeZone: "America/Sao_Paulo" } as const;
const fmt = (d: Date) => d.toLocaleString("pt-BR", { ...tz, dateStyle: "short", timeStyle: "short" });

export default async function RegistroPage({
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
    include: {
      author: { select: { name: true } },
      attachments: { select: { id: true, fileName: true, mimeType: true, size: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!entry || entry.patientId !== id) notFound();

  const p = access.patient;
  const t = isEntryType(entry.type) ? ENTRY_TYPES[entry.type] : { label: entry.type, color: "#6b7280" };
  const edited = entry.updatedAt.getTime() - entry.createdAt.getTime() > 60_000;
  const images = entry.attachments.filter((a) => /^image\/(png|jpeg|gif|webp)$/.test(a.mimeType));

  return (
    <div className="max-w-3xl">
      <Link href={`/pacientes/${id}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 print:hidden">
        <ArrowLeft size={16} /> {p.name}
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-t-4 p-6" style={{ borderTopColor: t.color }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-medium" style={{ color: t.color }}>{t.label}</p>
            <h1 className="text-xl font-bold text-gray-900">{entry.title || t.label}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {fmt(entry.occurredAt)} · {entry.author.name}
              {edited && ` · editado em ${fmt(entry.updatedAt)}`}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <PrintButton />
            {canEditEntry(session, entry) && (
              <Link href={`/pacientes/${id}/geral/${entryId}/editar`}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <Pencil size={14} /> Editar
              </Link>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
          Paciente: <span className="text-gray-800 font-medium">{p.name}</span> · {p.species}
          {p.breed ? ` · ${p.breed}` : ""} · Tutor: {p.ownerName} · {p.unit.name}
        </div>

        {entry.type === "PESO" && (
          <p className="text-3xl font-bold text-gray-900 mb-4">{entry.weight?.toLocaleString("pt-BR")} kg</p>
        )}

        {entry.content.trim() ? (
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{entry.content}</div>
        ) : entry.type !== "PESO" ? (
          <p className="text-sm text-gray-400">Sem descrição.</p>
        ) : null}

        {entry.attachments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-900 mb-2">Anexos ({entry.attachments.length})</p>
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {images.map((a) => (
                  <a key={a.id} href={`/api/clinical-attachments/${a.id}`} target="_blank" rel="noopener" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/clinical-attachments/${a.id}`} alt={a.fileName}
                      className="w-full h-32 object-cover rounded-lg border border-gray-100" />
                  </a>
                ))}
              </div>
            )}
            <ul className="space-y-1">
              {entry.attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm py-1.5">
                  <a href={`/api/clinical-attachments/${a.id}`} target="_blank" rel="noopener"
                    className="flex items-center gap-2 text-primary hover:underline min-w-0">
                    {a.mimeType.startsWith("image/") ? <ImageIcon size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}
                    <span className="truncate">{a.fileName}</span>
                  </a>
                  <span className="flex items-center gap-3 shrink-0 text-gray-400">
                    {formatSize(a.size)}
                    <a href={`/api/clinical-attachments/${a.id}?download=1`} aria-label={`Baixar ${a.fileName}`}
                      className="hover:text-gray-600 print:hidden">
                      <Download size={14} />
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
