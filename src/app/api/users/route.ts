import { prisma } from "@/lib/prisma";
import { generateTempPassword, getSession, hashPassword } from "@/lib/auth";
import { NextRequest } from "next/server";
import { assignableRoles, canManageUsers, isRole, seesAllUnits } from "@/lib/roles";
import { sendAccessEmail } from "@/lib/mailer";
import { loginTakenError, manageableUsersWhere, parseLoginFields, validateUnitIds } from "@/lib/users";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManageUsers(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: manageableUsersWhere(session),
    select: {
      id: true, name: true, email: true, phone: true, role: true, active: true, mustChangePassword: true, createdAt: true,
      units: { select: { unit: { select: { id: true, name: true } } } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return Response.json(users);
}

// Cria o acesso com senha provisória (mostrada uma única vez para quem criou)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManageUsers(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return Response.json({ error: "Informe o nome" }, { status: 400 });
  const login = parseLoginFields(body);
  if ("error" in login) return Response.json({ error: login.error }, { status: 400 });
  const { email, phone } = login;
  if (!isRole(body.role) || !assignableRoles(session.role).includes(body.role)) {
    return Response.json({ error: "Função não permitida" }, { status: 403 });
  }
  const units = await validateUnitIds(session, body.unitIds ?? []);
  if ("error" in units) return Response.json({ error: units.error }, { status: 400 });
  if (!seesAllUnits(body.role) && units.ids.length === 0) {
    return Response.json({ error: "Escolha ao menos uma unidade" }, { status: 400 });
  }
  const taken = await loginTakenError({ email, phone });
  if (taken) return Response.json({ error: taken }, { status: 409 });

  const tempPassword = generateTempPassword();
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name, email, phone, role: body.role,
        organizationId: session.organizationId,
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
        units: { create: units.ids.map((unitId) => ({ unitId })) },
      },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });
    await tx.auditLog.create({
      data: { userId: session.id, action: "CREATE", entity: "User", entityId: created.id, details: JSON.stringify({ email, phone, role: body.role, unitIds: units.ids }) },
    });
    return created;
  });

  const emailSent = await sendAccessEmail(user, tempPassword, new URL(request.url).origin, false);
  return Response.json({ ...user, tempPassword, emailSent }, { status: 201 });
}
