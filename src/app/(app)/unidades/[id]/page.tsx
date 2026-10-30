import { prisma } from "@/lib/prisma";
import { canManageUnits, canViewUnitDetails } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { normalizeSpecies } from "@/lib/species";
import { formatCep, formatCnpj } from "@/lib/units";
import { canSeeDocument } from "@/lib/unit-documents";
import UnitForm from "../UnitForm";
import UnitDocuments from "./UnitDocuments";

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "--/--/----");

export default async function EditarUnidadePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  // Matriz e administrativo editam; o comercial só consulta
  if (!canViewUnitDetails(session.role)) notFound();
  const canEdit = canManageUnits(session.role);

  const { id } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      _count: { select: { users: true } },
      documents: {
        orderBy: [{ createdAt: "asc" }],
        include: { attachments: { select: { id: true, fileName: true, size: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!unit) notFound();

  // Padrões primeiro (Cartão CNPJ, Contrato Social, Contrato UABC), depois os demais por criação
  const order = ["CNPJ_CARD", "SOCIAL_CONTRACT", "UABC_CONTRACT"];
  const documents = unit.documents
    .filter((d) => canSeeDocument(canEdit, d.visibility))
    .sort((a, b) => (order.indexOf(a.kind) + 1 || 99) - (order.indexOf(b.kind) + 1 || 99))
    .map((d) => ({
      id: d.id, kind: d.kind, name: d.name, notes: d.notes, visibility: d.visibility,
      dueDate: d.dueDate?.toISOString().slice(0, 10) ?? null,
      // Documento padrão nunca mexido não tem "última modificação"
      updatedAt: d.updatedById || d.attachments.length || d.notes ? d.updatedAt.toISOString() : null,
      attachments: d.attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    }));

  // Unidade antiga só com o endereço em texto livre: vai para o logradouro até alguém completar
  const structured = unit.zipCode || unit.street || unit.number || unit.district;

  return (
    <div className="max-w-6xl space-y-4">
      <Link href="/unidades" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Unidades
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex">
        <div className="w-2 sm:w-3 bg-primary shrink-0" />
        <div className="flex flex-1 flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {unit.name}
              <span className={`inline-block w-3 h-3 rounded-full ${unit.active ? "bg-green-500" : "bg-gray-300"}`} title={unit.active ? "Ativa" : "Desativada"} />
            </h1>
            {unit.legalName && <p className="text-sm text-gray-600 mt-1">{unit.legalName}</p>}
            {unit.cnpj && <p className="text-sm text-gray-500">{formatCnpj(unit.cnpj)}</p>}
            <p className="text-xs text-gray-400 mt-1">{unit._count.users} acesso{unit._count.users === 1 ? "" : "s"} vinculado{unit._count.users === 1 ? "" : "s"}</p>
          </div>
          <div className="flex items-start gap-6">
            {canEdit && (
              <Link href={`/usuarios/novo?unidade=${unit.id}`} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <UserPlus size={16} /> Criar acesso
              </Link>
            )}
            <dl className="text-right text-xs text-gray-500 space-y-2">
              <div><dt>Criada em</dt><dd className="font-semibold text-gray-700">{fmtDate(unit.createdAt)}</dd></div>
              <div><dt>Inativada em</dt><dd className="font-semibold text-gray-700">{fmtDate(unit.inactivatedAt)}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <UnitForm
        readOnly={!canEdit}
        initial={{
          id: unit.id, name: unit.name, city: unit.city, state: unit.state, address: unit.address ?? "",
          species: [...new Set(unit.species.split(",").map((s) => normalizeSpecies(s)).filter((s) => s !== null))],
          generalRecordEnabled: unit.generalRecordEnabled, serviceOrderEnabled: unit.serviceOrderEnabled, active: unit.active,
          cnpj: unit.cnpj ?? "", legalName: unit.legalName ?? "", tradeName: unit.tradeName ?? "",
          legalNature: unit.legalNature ?? "", legalCategory: unit.legalCategory ?? "", stateRegistration: unit.stateRegistration ?? "",
          shareCapital: unit.shareCapital ? unit.shareCapital.toFixed(2).replace(".", ",") : "",
          zipCode: formatCep(unit.zipCode), street: unit.street ?? (structured ? "" : unit.address ?? ""),
          number: unit.number ?? "", complement: unit.complement ?? "", district: unit.district ?? "",
          phones: unit.phones, mobiles: unit.mobiles, emails: unit.emails, billingEmails: unit.billingEmails, financeEmails: unit.financeEmails,
        }}
      />

      <UnitDocuments unitId={unit.id} documents={documents} canEdit={canEdit} />
    </div>
  );
}
