import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { assignableRoles, isRole } from "@/lib/roles";
import { getManageableUser, validateUnitIds } from "@/lib/users";

// Edita nome, função, unidades ou ativa/desativa o acesso
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await getManageableUser(session, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { user } = access;
  const isSelf = user.id === session.id;

  const body = await request.json();
  const data: { name?: string; role?: string; active?: boolean } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) return Response.json({ error: "Informe o nome" }, { status: 400 });
    data.name = name;
  }
  if (body.role !== undefined && body.role !== user.role) {
    if (isSelf) return Response.json({ error: "Você não pode mudar a sua própria função" }, { status: 400 });
    if (!isRole(body.role) || !assignableRoles(session.role).includes(body.role)) {
      return Response.json({ error: "Função não permitida" }, { status: 403 });
    }
    data.role = body.role;
  }
  if (typeof body.active === "boolean" && body.active !== user.active) {
    if (isSelf) return Response.json({ error: "Você não pode desativar o seu próprio acesso" }, { status: 400 });
    data.active = body.active;
  }

  // Unidades: o gestor só mexe nas dele; vínculos com outras unidades são mantidos
  let nextUnitIds: string[] | null = null;
  if (body.unitIds !== undefined) {
    const units = await validateUnitIds(session, body.unitIds);
    if ("error" in units) return Response.json({ error: units.error }, { status: 400 });
    const current = user.units.map((u) => u.unitId);
    const outside = session.role === "ADMIN" ? [] : current.filter((u) => !session.unitIds.includes(u));
    nextUnitIds = [...new Set([...outside, ...units.ids])];
    if ((data.role ?? user.role) !== "ADMIN" && nextUnitIds.length === 0) {
      return Response.json({ error: "Escolha ao menos uma unidade" }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, active: true } });
    if (nextUnitIds) {
      await tx.userUnit.deleteMany({ where: { userId: id, unitId: { notIn: nextUnitIds } } });
      const existing = new Set(user.units.map((x) => x.unitId));
      const toAdd = nextUnitIds.filter((x) => !existing.has(x));
      if (toAdd.length) await tx.userUnit.createMany({ data: toAdd.map((unitId) => ({ userId: id, unitId })) });
    }
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "UPDATE", entity: "User", entityId: id,
        details: JSON.stringify({ changed: { ...data, ...(nextUnitIds ? { unitIds: nextUnitIds } : {}) }, before: { name: user.name, role: user.role, active: user.active, unitIds: user.units.map((x) => x.unitId) } }),
      },
    });
    return u;
  });
  return Response.json(updated);
}
