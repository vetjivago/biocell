import { prisma } from "@/lib/prisma";
import { formatPhone } from "@/lib/phone";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { canManageUsers, roleLabel } from "@/lib/roles";
import { manageableUsersWhere } from "@/lib/users";

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!canManageUsers(session.role)) notFound();
  const { q } = await searchParams;
  const query = q?.trim();

  const users = await prisma.user.findMany({
    where: {
      ...manageableUsersWhere(session),
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, ...(query.replace(/\D/g, "").length >= 4 ? [{ phone: { contains: query.replace(/\D/g, "") } }] : []), { units: { some: { unit: { name: { contains: query, mode: "insensitive" } } } } }] } : {}),
    },
    select: {
      id: true, name: true, email: true, phone: true, role: true, active: true, mustChangePassword: true,
      units: { select: { unit: { select: { name: true } } } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} acesso(s){session.role === "ADMIN" ? "" : " da(s) sua(s) unidade(s)"}
          </p>
        </div>
        <Link href="/usuarios/novo" className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-lg text-sm font-medium">
          <Plus size={16} /> Novo acesso
        </Link>
      </div>

      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Buscar por nome, e-mail, celular ou unidade..."
          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm" />
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full min-w-[720px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nome</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Função</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Unidades</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 ${u.active ? "" : "opacity-60"}`}>
                <td className="px-4 py-3">
                  <Link href={`/usuarios/${u.id}`} className="text-sm font-medium text-primary hover:underline">{u.name}</Link>
                  <p className="text-xs text-gray-500">{[u.email, formatPhone(u.phone)].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{roleLabel(u.role)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {u.role === "ADMIN" ? "Todas" : u.units.map((x) => x.unit.name.replace(/^UABC\s+/i, "")).join(", ") || "–"}
                </td>
                <td className="px-4 py-3">
                  {!u.active ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">Desativado</span>
                  ) : u.mustChangePassword ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">Aguardando 1º acesso</span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">Ativo</span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">Nenhum usuário encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
