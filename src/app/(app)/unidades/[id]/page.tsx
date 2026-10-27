import { prisma } from "@/lib/prisma";
import { canManageUnits } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { normalizeSpecies } from "@/lib/species";
import UnitForm from "../UnitForm";

export default async function EditarUnidadePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!canManageUnits(session.role)) notFound();

  const { id } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id, organizationId: session.organizationId },
    include: { _count: { select: { users: true } } },
  });
  if (!unit) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/unidades" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Unidades
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{unit.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{unit._count.users} acesso{unit._count.users === 1 ? "" : "s"} vinculado{unit._count.users === 1 ? "" : "s"}</p>
        </div>
        <Link href={`/usuarios/novo?unidade=${unit.id}`} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <UserPlus size={16} /> Criar acesso
        </Link>
      </div>
      <UnitForm
        initial={{
          id: unit.id, name: unit.name, city: unit.city, state: unit.state,
          address: unit.address ?? "", phone: unit.phone ?? "",
          species: [...new Set(unit.species.split(",").map((s) => normalizeSpecies(s)).filter((s) => s !== null))],
          generalRecordEnabled: unit.generalRecordEnabled, serviceOrderEnabled: unit.serviceOrderEnabled, active: unit.active,
        }}
      />
    </div>
  );
}
