import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assignableRoles, isRole } from "@/lib/roles";
import { getManageableUser } from "@/lib/users";
import { formatPhone } from "@/lib/phone";
import UserForm from "../UserForm";

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const access = await getManageableUser(session, id);
  if ("error" in access) notFound();
  const { user } = access;
  if (!isRole(user.role)) notFound();

  const units = await prisma.unit.findMany({
    where: { active: true, ...(session.role === "ADMIN" ? {} : { id: { in: session.unitIds } }) },
    select: { id: true, name: true, city: true, state: true },
    orderBy: { name: "asc" },
  });
  // Gestor vê e altera só as unidades dele (vínculos com outras são mantidos pela API)
  const visibleUnitIds = user.units.map((u) => u.unitId).filter((u) => units.some((x) => x.id === u));
  const roles = assignableRoles(session.role);

  return (
    <div className="max-w-3xl">
      <Link href="/usuarios" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Usuários
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{user.name}</h1>
      <UserForm
        isSelf={user.id === session.id}
        roles={roles.includes(user.role) ? roles : [user.role, ...roles]}
        units={units}
        initial={{ id: user.id, name: user.name, email: user.email ?? "", phone: formatPhone(user.phone), role: user.role, unitIds: visibleUnitIds, active: user.active }}
      />
    </div>
  );
}
