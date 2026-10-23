import { prisma } from "@/lib/prisma";
import { generateTempPassword, getSession, hashPassword } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getManageableUser } from "@/lib/users";
import { sendAccessEmail } from "@/lib/mailer";

// Gera nova senha provisória (a pessoa troca no próximo login)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getManageableUser(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  if (access.user.id === session.id) {
    return Response.json({ error: "Para a sua própria senha use “Minha conta”" }, { status: 400 });
  }

  const tempPassword = generateTempPassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true } }),
    prisma.auditLog.create({ data: { userId: session.id, action: "RESET_PASSWORD", entity: "User", entityId: id } }),
  ]);
  const emailSent = await sendAccessEmail(access.user, tempPassword, new URL(request.url).origin, true);
  return Response.json({ tempPassword, emailSent });
}
