import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Stethoscope, ClipboardList, FlaskConical, Scale, Pill, Syringe, MessageSquare, FileText, Paperclip, Dna,
  Activity, Camera, Video, BedDouble, Pencil, Phone, Mail, MapPin, CalendarClock,
} from "lucide-react";
import { ENTRY_TYPES, isEntryType, type EntryType } from "@/lib/clinical-types";
import { ORDER_STATUS, orderStatus } from "@/lib/service-order-types";
import { formatAge } from "@/lib/patient-fields";
import PrintButton from "./geral/PrintButton";
import PhotoUpload from "./PhotoUpload";

const ENTRY_ICONS: Record<EntryType, typeof Stethoscope> = {
  ATENDIMENTO: Stethoscope,
  ANAMNESE: ClipboardList,
  PESO: Scale,
  PATOLOGIA: Activity,
  DOCUMENTO: FileText,
  EXAME: FlaskConical,
  FOTOS: Camera,
  VACINA: Syringe,
  RECEITA: Pill,
  OBSERVACAO: MessageSquare,
  VIDEO: Video,
  INTERNACAO: BedDouble,
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Aberto", cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "Em andamento", cls: "bg-yellow-100 text-yellow-700" },
  COMPLETED: { label: "Concluído", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-700" },
};

const CT_COLOR = "#00af6b";
const OS_COLOR = "#ca8a04";
const TZ = "America/Sao_Paulo";
// Filtro de tipos: registros do prontuário geral + células-tronco (prontuário CT e OS)
const FILTER_KEYS = [...(Object.keys(ENTRY_TYPES) as EntryType[]), "CT"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export default async function PacienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; tipos?: string; de?: string; ate?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const { aba, tipos, de, ate } = await searchParams;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      unit: { select: { name: true, generalRecordEnabled: true, serviceOrderEnabled: true } },
      photo: { select: { updatedAt: true } },
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

  // Tipos selecionados (vazio = todos; "nenhum" = nenhum)
  const selected = new Set<FilterKey>(
    tipos === "nenhum" ? [] : (tipos ? tipos.split(",").filter((t): t is FilterKey => (FILTER_KEYS as readonly string[]).includes(t)) : FILTER_KEYS)
  );
  const allSelected = selected.size === FILTER_KEYS.length;
  const from = de && /^\d{4}-\d{2}-\d{2}$/.test(de) ? new Date(`${de}T00:00:00-03:00`) : null;
  const to = ate && /^\d{4}-\d{2}-\d{2}$/.test(ate) ? new Date(`${ate}T23:59:59.999-03:00`) : null;
  const inPeriod = (d: Date) => (!from || d >= from) && (!to || d <= to);

  const allEntries = generalEnabled
    ? await prisma.clinicalEntry.findMany({
        where: { patientId: id },
        orderBy: { occurredAt: "desc" },
        include: { author: { select: { name: true } }, _count: { select: { attachments: true } } },
      })
    : [];
  const entries = allEntries.filter((e) => selected.has(e.type as FilterKey) && inPeriod(e.occurredAt));

  // Cabeçalho: patologias, peso mais recente e próximo retorno
  const pathologies = [...new Set([
    ...allEntries.filter((e) => e.type === "PATOLOGIA" && e.title).map((e) => e.title!),
    ...(patient.medicalRecords[0] ? [patient.medicalRecords[0].pathology] : []),
  ])];
  const lastWeight = allEntries.find((e) => e.type === "PESO");
  const now = new Date();
  const nextReturn = allEntries
    .filter((e) => e.returnDate && e.returnDate >= new Date(now.toISOString().slice(0, 10)))
    .sort((a, b) => a.returnDate!.getTime() - b.returnDate!.getTime())[0];
  const admitted = allEntries.find((e) => e.type === "INTERNACAO" && !e.endedAt);
  const age = formatAge(patient.birthDate);

  type TimelineItem =
    | { kind: "entry"; date: Date; entry: (typeof entries)[number] }
    | { kind: "ct"; date: Date; record: (typeof patient.medicalRecords)[number] }
    | { kind: "os"; date: Date; order: (typeof patient.serviceOrders)[number] };
  const timeline: TimelineItem[] = [
    ...entries.map((entry) => ({ kind: "entry" as const, date: entry.occurredAt, entry })),
    ...(selected.has("CT")
      ? [
          ...patient.medicalRecords.filter((r) => inPeriod(r.createdAt)).map((record) => ({ kind: "ct" as const, date: record.createdAt, record })),
          ...patient.serviceOrders.filter((o) => inPeriod(o.createdAt)).map((order) => ({ kind: "os" as const, date: order.createdAt, order })),
        ]
      : []),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const byYear = new Map<number, TimelineItem[]>();
  for (const item of timeline) {
    const y = Number(item.date.toLocaleString("pt-BR", { year: "numeric", timeZone: TZ }));
    byYear.set(y, [...(byYear.get(y) || []), item]);
  }

  const fmtDateTime = (d: Date) =>
    d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(",", " às");
  const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });

  // Links do filtro mantêm período e os demais tipos
  const base = `/pacientes/${patient.id}`;
  const qs = (next: Set<FilterKey> | "todos" | "nenhum") => {
    const p = new URLSearchParams();
    if (next === "nenhum") p.set("tipos", "nenhum");
    else if (next !== "todos" && next.size !== FILTER_KEYS.length) p.set("tipos", next.size ? [...next].join(",") : "nenhum");
    if (de) p.set("de", de);
    if (ate) p.set("ate", ate);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const toggle = (k: FilterKey) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return qs(next);
  };
  const filterLabel = (k: FilterKey) => (k === "CT" ? "Células-tronco" : ENTRY_TYPES[k].label);
  const filterColor = (k: FilterKey) => (k === "CT" ? CT_COLOR : ENTRY_TYPES[k].color);

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <Link href="/pacientes" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`${base}/editar`} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <Pencil size={14} /> Editar cadastro
          </Link>
          <Link href={`/prontuarios/novo?patientId=${patient.id}`} className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
            <Plus size={14} /> Prontuário CT
          </Link>
        </div>
      </div>

      {/* Cabeçalho: tutor à esquerda, animal à direita (como no SimplesVet) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 print:shadow-none print:border-0 print:p-0">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-6 items-start">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-400">Responsável</p>
            <h2 className="text-xl font-semibold text-gray-900">{patient.ownerName || "–"}</h2>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              {patient.ownerPhone && (
                <a href={`tel:${patient.ownerPhone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 text-primary hover:underline"><Phone size={13} />{patient.ownerPhone}</a>
              )}
              {patient.ownerEmail && (
                <a href={`mailto:${patient.ownerEmail}`} className="flex items-center gap-1.5 text-primary hover:underline break-all"><Mail size={13} />{patient.ownerEmail}</a>
              )}
              {patient.ownerAddress && <p className="flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0" />{patient.ownerAddress}</p>}
              {(patient.veterinarian || patient.clinic) && (
                <p className="text-gray-500">Vet.: {[patient.veterinarian, patient.clinic].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-400">Animal</p>
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-gray-600">
              <p>{[patient.species, patient.breed, patient.coat].filter(Boolean).join(", ")}</p>
              <p>
                {patient.weight ? `${patient.weight.toLocaleString("pt-BR")} kg` : "Peso –"}
                {lastWeight ? ` em ${lastWeight.occurredAt.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: TZ })}` : ""}
              </p>
              <p>{patient.sex ? `${patient.sex}${patient.neutered ? (patient.sex === "Fêmea" ? " castrada" : " castrado") : ""}` : patient.neutered ? "Castrado(a)" : "Sexo –"}</p>
              <p>{age || "Idade –"}</p>
              {patient.microchip && <p className="sm:col-span-2">Microchip: {patient.microchip}</p>}
              <p className="sm:col-span-2 text-gray-400">{patient.unit.name}</p>
            </div>
            {(pathologies.length > 0 || nextReturn || admitted) && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {pathologies.map((p) => (
                  <span key={p} className="px-2 py-1 rounded text-xs font-semibold text-white bg-amber-600">{p}</span>
                ))}
                {admitted && <span className="px-2 py-1 rounded text-xs font-semibold text-white" style={{ backgroundColor: ENTRY_TYPES.INTERNACAO.color }}>Internado</span>}
                {nextReturn?.returnDate && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                    <CalendarClock size={12} /> Retorno {fmtDay(nextReturn.returnDate)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="print:hidden">
            <PhotoUpload patientId={patient.id} hasPhoto={!!patient.photo} version={patient.photo?.updatedAt.getTime().toString() || "0"} />
          </div>
        </div>
      </div>

      {generalEnabled && (
        <div className="flex gap-1 border-b border-gray-200 mb-4 print:hidden">
          {[
            { key: "geral", label: "Histórico" },
            { key: "ct", label: `Células-tronco (${patient.medicalRecords.length})` },
          ].map((t) => (
            <Link
              key={t.key}
              href={`${base}${t.key === "ct" ? "?aba=ct" : ""}`}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {tab === "geral" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Adicionar (aparece primeiro no celular) */}
          <div className="lg:order-2 print:hidden">
            <h2 className="font-semibold text-gray-900 mb-3">Adicionar</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
              {(Object.keys(ENTRY_TYPES) as EntryType[]).map((key) => {
                const Icon = ENTRY_ICONS[key];
                return (
                  <Link
                    key={key}
                    href={`${base}/geral/novo?tipo=${key}`}
                    style={{ backgroundColor: ENTRY_TYPES[key].color }}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-lg py-3 px-2 text-white text-sm font-medium hover:opacity-90 text-center"
                  >
                    <Icon size={20} />
                    {ENTRY_TYPES[key].label}
                  </Link>
                );
              })}
            </div>
            {patient.unit.serviceOrderEnabled && (
              <Link href={`/ordens-servico/nova?patientId=${patient.id}`}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg py-3 text-white text-sm font-medium hover:opacity-90"
                style={{ backgroundColor: OS_COLOR }}>
                <FlaskConical size={18} /> Ordem de Serviço - Halógena
              </Link>
            )}
          </div>

          {/* Histórico */}
          <div className="lg:order-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4 space-y-3 print:hidden">
              <form method="get" action={base} className="flex flex-wrap items-end gap-2">
                {tipos && <input type="hidden" name="tipos" value={tipos} />}
                <label className="text-xs text-gray-500">De
                  <input type="date" name="de" defaultValue={de} className="block px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </label>
                <label className="text-xs text-gray-500">Até
                  <input type="date" name="ate" defaultValue={ate} className="block px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </label>
                <button type="submit" className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm">Filtrar período</button>
                {(de || ate) && (
                  <Link href={tipos ? `${base}?tipos=${tipos}` : base} className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700">Limpar</Link>
                )}
                <span className="ml-auto"><PrintButton /></span>
              </form>
              <div className="flex flex-wrap items-center gap-1.5">
                {FILTER_KEYS.map((k) => {
                  const on = selected.has(k);
                  return (
                    <Link key={k} href={toggle(k)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${on ? "text-white" : "bg-white text-gray-500 border-gray-200"}`}
                      style={on ? { backgroundColor: filterColor(k), borderColor: filterColor(k) } : undefined}>
                      {filterLabel(k)}
                    </Link>
                  );
                })}
                <span className="text-xs text-gray-400 ml-1">
                  <Link href={qs("todos")} className={`hover:underline ${allSelected ? "font-semibold text-gray-600" : ""}`}>todos</Link>
                  {" | "}
                  <Link href={qs("nenhum")} className={`hover:underline ${selected.size === 0 ? "font-semibold text-gray-600" : ""}`}>nenhum</Link>
                </span>
              </div>
            </div>

            <div className="hidden print:block mb-2 text-sm text-gray-600">
              Histórico{from || to ? ` de ${de ? fmtDay(new Date(de)) : "início"} a ${ate ? fmtDay(new Date(ate)) : "hoje"}` : ""}
            </div>

            {timeline.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
                {allEntries.length === 0 && patient.medicalRecords.length === 0
                  ? "Nenhum registro no prontuário ainda. Use os botões em “Adicionar”."
                  : "Nenhum registro com os filtros escolhidos."}
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
                          className="block bg-white rounded-lg border border-gray-100 border-l-4 px-4 py-3 hover:bg-gray-50 break-inside-avoid"
                          style={{ borderLeftColor: OS_COLOR }}>
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
                          className="block bg-white rounded-lg border border-gray-100 border-l-4 px-4 py-3 hover:bg-gray-50 break-inside-avoid"
                          style={{ borderLeftColor: CT_COLOR }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500">{fmtDateTime(r.createdAt)}</p>
                              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Dna size={14} /> Prontuário CT</p>
                              <p className="text-sm text-gray-600 truncate">{r.pathology} · Nº {r.serialNumber}</p>
                            </div>
                            <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                          </div>
                        </Link>
                      );
                    }
                    const e = item.entry;
                    const t = isEntryType(e.type) ? ENTRY_TYPES[e.type] : { label: e.type, color: "#6b7280" };
                    const firstLine = e.content.split("\n").find((l) => l.trim()) || "";
                    const line1 = e.type === "ATENDIMENTO" && e.subtype ? e.subtype : null;
                    const line2 = e.type === "PESO"
                      ? `${e.weight?.toLocaleString("pt-BR")} kg${e.title ? ` – ${e.title}` : ""}`
                      : e.type === "INTERNACAO"
                        ? `${e.endedAt ? `Alta em ${e.endedAt.toLocaleDateString("pt-BR", { timeZone: TZ })}` : "Internado"}${e.title ? ` · ${e.title}` : ""}`
                        : e.title || firstLine;
                    return (
                      <Link key={e.id} href={`${base}/geral/${e.id}`}
                        className="block bg-white rounded-lg border border-gray-100 border-l-4 px-4 py-3 hover:bg-gray-50 break-inside-avoid"
                        style={{ borderLeftColor: t.color }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500">{fmtDateTime(e.occurredAt)}</p>
                            <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                            {line1 && <p className="text-sm text-gray-700 truncate">{line1}</p>}
                            {line2 && <p className="text-sm text-gray-600 truncate">{line2}</p>}
                            {e.returnDate && (
                              <p className="text-xs text-blue-700 mt-0.5 flex items-center gap-1"><CalendarClock size={12} /> Retorno {fmtDay(e.returnDate)}</p>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1 text-xs text-gray-400">
                            <span title={e.author.name} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-medium text-gray-500">{initials(e.author.name)}</span>
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

function initials(name: string) {
  return name.split(/\s+/).filter((p) => p && !/^(dr|dra)\.?$/i.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
