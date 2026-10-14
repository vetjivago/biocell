import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Stethoscope, ClipboardList, FlaskConical, Scale, Pill, Syringe, MessageSquare, FileText, Paperclip, Dna,
} from "lucide-react";
import { ENTRY_TYPES, isEntryType, type EntryType } from "@/lib/clinical-types";
import { ORDER_STATUS, orderStatus } from "@/lib/service-order-types";

const ENTRY_ICONS: Record<EntryType, typeof Stethoscope> = {
  ATENDIMENTO: Stethoscope,
  ANAMNESE: ClipboardList,
  EXAME: FlaskConical,
  PESO: Scale,
  RECEITA: Pill,
  VACINA: Syringe,
  OBSERVACAO: MessageSquare,
  DOCUMENTO: FileText,
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Aberto", cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "Em andamento", cls: "bg-yellow-100 text-yellow-700" },
  COMPLETED: { label: "Concluído", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-700" },
};

const CT_COLOR = "#00af6b";

export default async function PacienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; tipo?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const { aba, tipo } = await searchParams;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      unit: { select: { name: true, generalRecordEnabled: true, serviceOrderEnabled: true } },
      serviceOrders: {
        orderBy: { createdAt: "desc" },
        include: { applications: { select: { number: true, status: true } } },
      },
      medicalRecords: {
        include: { professional: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!patient) notFound();
  if (session.role !== "ADMIN" && !session.unitIds.includes(patient.unitId)) notFound();

  const generalEnabled = patient.unit.generalRecordEnabled;
  const tab = generalEnabled && aba !== "ct" ? "geral" : "ct";
  const typeFilter = tipo === "CT" || isEntryType(tipo) ? tipo : undefined;

  const entries = tab === "geral"
    ? await prisma.clinicalEntry.findMany({
        where: { patientId: id, ...(typeFilter && typeFilter !== "CT" ? { type: typeFilter } : {}) },
        orderBy: { occurredAt: "desc" },
        include: { author: { select: { name: true } }, _count: { select: { attachments: true } } },
      })
    : [];

  // Linha do tempo: registros do prontuário geral + prontuários de células-tronco
  type TimelineItem =
    | { kind: "entry"; date: Date; entry: (typeof entries)[number] }
    | { kind: "ct"; date: Date; record: (typeof patient.medicalRecords)[number] }
    | { kind: "os"; date: Date; order: (typeof patient.serviceOrders)[number] };
  const timeline: TimelineItem[] = [
    ...(typeFilter === "CT" ? [] : entries.map((entry) => ({ kind: "entry" as const, date: entry.occurredAt, entry }))),
    ...(!typeFilter || typeFilter === "CT"
      ? [
          ...patient.medicalRecords.map((record) => ({ kind: "ct" as const, date: record.createdAt, record })),
          ...patient.serviceOrders.map((order) => ({ kind: "os" as const, date: order.createdAt, order })),
        ]
      : []),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const byYear = new Map<number, TimelineItem[]>();
  for (const item of timeline) {
    const y = item.date.getFullYear();
    byYear.set(y, [...(byYear.get(y) || []), item]);
  }

  const fmtDateTime = (d: Date) =>
    d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " às");

  return (
    <div className="max-w-5xl">
      <Link href="/pacientes" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
          <Link href={`/prontuarios/novo?patientId=${patient.id}`} className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
            <Plus size={14} /> Prontuário CT
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500">Espécie</p><p className="font-medium">{patient.species}</p></div>
          <div><p className="text-gray-500">Raça</p><p className="font-medium">{patient.breed || "–"}</p></div>
          <div><p className="text-gray-500">Peso</p><p className="font-medium">{patient.weight ? `${patient.weight} kg` : "–"}</p></div>
          <div><p className="text-gray-500">Unidade</p><p className="font-medium">{patient.unit.name}</p></div>
          <div><p className="text-gray-500">Responsável</p><p className="font-medium">{patient.ownerName}</p></div>
          <div><p className="text-gray-500">Telefone</p><p className="font-medium">{patient.ownerPhone || "–"}</p></div>
          <div><p className="text-gray-500">Veterinário</p><p className="font-medium">{patient.veterinarian || "–"}</p></div>
          <div><p className="text-gray-500">Clínica</p><p className="font-medium">{patient.clinic || "–"}</p></div>
        </div>
      </div>

      {generalEnabled && (
        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {[
            { key: "geral", label: "Prontuário geral" },
            { key: "ct", label: `Células-tronco (${patient.medicalRecords.length})` },
          ].map((t) => (
            <Link
              key={t.key}
              href={`/pacientes/${patient.id}${t.key === "ct" ? "?aba=ct" : ""}`}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {tab === "geral" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Adicionar (aparece primeiro no celular) */}
          <div className="lg:order-2">
            <h2 className="font-semibold text-gray-900 mb-3">Adicionar</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ENTRY_TYPES) as EntryType[]).map((key) => {
                const Icon = ENTRY_ICONS[key];
                return (
                  <Link
                    key={key}
                    href={`/pacientes/${patient.id}/geral/novo?tipo=${key}`}
                    style={{ backgroundColor: ENTRY_TYPES[key].color }}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-lg py-3 px-2 text-white text-sm font-medium hover:opacity-90 text-center"
                  >
                    <Icon size={20} />
                    {ENTRY_TYPES[key].label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Linha do tempo */}
          <div className="lg:order-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-4">
              <FilterChip href={`/pacientes/${patient.id}`} active={!typeFilter} label="Todos" />
              {(Object.keys(ENTRY_TYPES) as EntryType[]).map((key) => (
                <FilterChip key={key} href={`/pacientes/${patient.id}?tipo=${key}`} active={typeFilter === key} label={ENTRY_TYPES[key].label} />
              ))}
              <FilterChip href={`/pacientes/${patient.id}?tipo=CT`} active={typeFilter === "CT"} label="Células-tronco" />
            </div>

            {timeline.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
                Nenhum registro {typeFilter ? "deste tipo" : "no prontuário"} ainda. Use os botões em “Adicionar”.
              </div>
            )}

            {[...byYear.entries()].map(([year, items]) => (
              <div key={year} className="mb-4">
                <p className="text-lg text-gray-700 mb-2">{year}</p>
                <div className="space-y-2">
                  {items.map((item) => {
                    if (item.kind === "os") {
                      const o = item.order;
                      const os = ORDER_STATUS[orderStatus(o)];
                      return (
                        <Link key={`os-${o.id}`} href={`/ordens-servico/${o.id}`}
                          className="block bg-white rounded-lg border border-gray-100 border-l-4 px-4 py-3 hover:bg-gray-50"
                          style={{ borderLeftColor: "#ca8a04" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500">{fmtDateTime(o.createdAt)}</p>
                              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><FlaskConical size={14} /> Ordem de Serviço - Halógena</p>
                              <p className="text-sm text-gray-600 truncate">Nº {o.serialNumber} · {o.applications.length} aplicação(ões)</p>
                            </div>
                            <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${os.cls}`}>{os.label}</span>
                          </div>
                        </Link>
                      );
                    }
                    if (item.kind === "ct") {
                      const r = item.record;
                      const st = statusConfig[r.status] || statusConfig.OPEN;
                      return (
                        <Link key={`ct-${r.id}`} href={`/prontuarios/${r.id}`}
                          className="block bg-white rounded-lg border border-gray-100 border-l-4 px-4 py-3 hover:bg-gray-50"
                          style={{ borderLeftColor: CT_COLOR }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500">{fmtDateTime(r.createdAt)}</p>
                              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Dna size={14} /> Prontuário CT</p>
                              <p className="text-sm text-gray-600 truncate">{r.pathology} · Nº {r.serialNumber.slice(0, 8)}</p>
                            </div>
                            <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                          </div>
                        </Link>
                      );
                    }
                    const e = item.entry;
                    const t = isEntryType(e.type) ? ENTRY_TYPES[e.type] : { label: e.type, color: "#6b7280" };
                    const summary = e.type === "PESO"
                      ? `${e.weight?.toLocaleString("pt-BR")} kg${e.title ? ` – ${e.title}` : ""}`
                      : e.title || e.content.split("\n").find((l) => l.trim()) || "";
                    return (
                      <Link key={e.id} href={`/pacientes/${patient.id}/geral/${e.id}`}
                        className="block bg-white rounded-lg border border-gray-100 border-l-4 px-4 py-3 hover:bg-gray-50"
                        style={{ borderLeftColor: t.color }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500">{fmtDateTime(e.occurredAt)}</p>
                            <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                            <p className="text-sm text-gray-600 truncate">{summary}</p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1 text-xs text-gray-400">
                            <span title={e.author.name}>{initials(e.author.name)}</span>
                            {e._count.attachments > 0 && (
                              <span className="flex items-center gap-0.5"><Paperclip size={12} />{e._count.attachments}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {patient.unit.serviceOrderEnabled && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Ordens de serviço ({patient.serviceOrders.length})</h2>
                <Link href={`/ordens-servico/nova?patientId=${patient.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5">
                  <FlaskConical size={14} /> Nova OS
                </Link>
              </div>
              <div className="space-y-2">
                {patient.serviceOrders.map((o) => {
                  const os = ORDER_STATUS[orderStatus(o)];
                  const pending = o.applications.find((a) => a.status !== "DONE");
                  return (
                    <Link key={o.id} href={`/ordens-servico/${o.id}`}
                      className="flex items-center justify-between gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md">
                      <div>
                        <p className="font-medium text-gray-900 font-mono">Nº {o.serialNumber}</p>
                        <p className="text-sm text-gray-500">
                          {o.applications.length} aplicação(ões){pending ? ` · ${pending.number}ª pendente` : ""} · {o.createdAt.toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${os.cls}`}>{os.label}</span>
                    </Link>
                  );
                })}
                {patient.serviceOrders.length === 0 && (
                  <p className="text-sm text-gray-400">Nenhuma OS. Abra uma para enviar ao preparo das células.</p>
                )}
              </div>
            </div>
          )}

          <h2 className="font-semibold text-gray-900 mb-3">Prontuários de células-tronco ({patient.medicalRecords.length})</h2>
          <div className="space-y-3">
            {patient.medicalRecords.map((r) => {
              const st = statusConfig[r.status] || statusConfig.OPEN;
              return (
                <Link key={r.id} href={`/prontuarios/${r.id}`} className="block bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{r.pathology}</p>
                      <p className="text-sm text-gray-500">{r.professional.name} • {new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                </Link>
              );
            })}
            {patient.medicalRecords.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum prontuário registrado</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href}
      className={`px-3 py-1 rounded-full text-xs font-medium border ${active ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
      {label}
    </Link>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter((p) => p && !/^(dr|dra)\.?$/i.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
