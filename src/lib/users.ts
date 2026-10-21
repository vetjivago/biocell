import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { assignableRoles, canManageUsers } from "./roles";
import { normalizePhone } from "./phone";

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

// E-mail e celular do formulário: vazio = não informado; preenchido errado = erro
export function parseLoginFields(body: { email?: unknown; phone?: unknown }) {
  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawEmail && !email) return { error: "E-mail inválido" } as const;
  if (rawPhone && !phone) return { error: "Celular inválido: use DDD + número, ex. (61) 99999-8888" } as const;
  if (!email && !phone) return { error: "Informe o e-mail ou o celular (é o que a pessoa usa para entrar)" } as const;
  return { email, phone } as const;
}

// E-mail ou celular já usado por outro acesso (excludeId: o próprio usuário, na edição)
export async function loginTakenError({ email, phone }: { email: string | null; phone: string | null }, excludeId?: string) {
  const not = excludeId ? { id: { not: excludeId } } : {};
  if (email && (await prisma.user.findFirst({ where: { email, ...not } }))) return "Já existe um acesso com este e-mail";
  if (phone && (await prisma.user.findFirst({ where: { phone, ...not } }))) return "Já existe um acesso com este celular";
  return null;
}
