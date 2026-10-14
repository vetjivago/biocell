import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

// Troca a própria senha (exige a senha atual)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const limit = checkRateLimit(`password:${session.id}`);
  if (!limit.allowed) return Response.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });

  const { currentPassword, newPassword } = await request.json();
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    return Response.json({ error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` }, { status: 400 });
  }
  if (newPassword === currentPassword) return Response.json({ error: "A nova senha precisa ser diferente da atual" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || typeof currentPassword !== "string" || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return Response.json({ error: "Senha atual incorreta" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false } }),
    prisma.auditLog.create({ data: { userId: user.id, action: "CHANGE_PASSWORD", entity: "User", entityId: user.id } }),
  ]);
  return Response.json({ ok: true });
}
