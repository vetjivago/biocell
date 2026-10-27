import { prisma } from "@/lib/prisma";
import { seesAllUnits } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assignableRoles, canManageUsers } from "@/lib/roles";
import UserForm from "../UserForm";

export default async function NovoUsuarioPage({ searchParams }: { searchParams: Promise<{ unidade?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!canManageUsers(session.role)) notFound();
  const { unidade } = await searchParams;

  const units = await prisma.unit.findMany({
    where: { active: true, ...(seesAllUnits(session.role) ? {} : { id: { in: session.unitIds } }) },
    select: { id: true, name: true, city: true, state: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <Link href="/usuarios" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Usuários
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo acesso</h1>
      <UserForm
        roles={assignableRoles(session.role)}
        units={units}
        initial={{
          name: "", email: "", phone: "",
          // Vindo do cadastro da unidade: já marca a unidade e sugere a função de gestor
          role: unidade && units.some((u) => u.id === unidade) ? "UNIT_MANAGER" : "PROFESSIONAL",
          unitIds: unidade && units.some((u) => u.id === unidade) ? [unidade] : units.length === 1 ? [units[0].id] : [],
          active: true,
        }}
      />
    </div>
  );
}
