import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { assignableRoles, canManageUsers } from "./roles";

// Usuários que quem está logado pode ver/gerenciar
export function manageableUsersWhere(session: SessionUser) {
  if (session.role === "ADMIN") return { deletedAt: null };
  // Gestor: equipe das suas unidades, sem acessos de matriz/estoque central
  return {
    deletedAt: null,
    role: { in: assignableRoles(session.role) },
    units: { some: { unitId: { in: session.unitIds } } },
  };
}

export async function getManageableUser(session: SessionUser, userId: string) {
  if (!canManageUsers(session.role)) return { error: "Sem permissão", status: 403 } as const;
  const user = await prisma.user.findFirst({
    where: { id: userId, ...manageableUsersWhere(session) },
    include: { units: { select: { unitId: true } } },
  });
  if (!user) return { error: "Usuário não encontrado", status: 404 } as const;
  return { user } as const;
}

// Unidades que podem ser atribuídas: matriz qualquer uma; gestor só as suas
export async function validateUnitIds(session: SessionUser, unitIds: unknown) {
  if (!Array.isArray(unitIds) || unitIds.some((u) => typeof u !== "string")) return { error: "Unidades inválidas" } as const;
  const ids = [...new Set(unitIds as string[])];
  if (session.role !== "ADMIN" && ids.some((u) => !session.unitIds.includes(u))) {
    return { error: "Você só pode atribuir as suas unidades" } as const;
  }
  const found = await prisma.unit.count({ where: { id: { in: ids } } });
  if (found !== ids.length) return { error: "Unidade não encontrada" } as const;
  return { ids } as const;
}

export function normalizeEmail(v: unknown) {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
