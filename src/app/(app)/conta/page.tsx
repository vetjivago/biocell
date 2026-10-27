import { prisma } from "@/lib/prisma";
import { seesAllUnits } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { roleLabel } from "@/lib/roles";
import { formatPhone } from "@/lib/phone";

export default async function ContaPage() {
  const session = await getSession();
  if (!session) return null;
  const units = seesAllUnits(session.role)
    ? []
    : await prisma.unit.findMany({ where: { id: { in: session.unitIds } }, select: { name: true }, orderBy: { name: "asc" } });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Minha conta</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><p className="text-gray-500">Nome</p><p className="font-medium">{session.name}</p></div>
        <div><p className="text-gray-500">E-mail</p><p className="font-medium break-all">{session.email || "–"}</p></div>
        <div><p className="text-gray-500">Celular</p><p className="font-medium">{formatPhone(session.phone) || "–"}</p></div>
        <div><p className="text-gray-500">Função</p><p className="font-medium">{roleLabel(session.role)}</p></div>
        <div><p className="text-gray-500">Unidades</p><p className="font-medium">{seesAllUnits(session.role) ? "Todas" : units.map((u) => u.name).join(", ") || "–"}</p></div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Trocar senha</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
