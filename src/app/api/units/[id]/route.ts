import { prisma } from "@/lib/prisma";
import { canManageUnits } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { parseUnitInput } from "@/lib/units";

// Matriz edita os dados da unidade, os módulos liberados ou ativa/desativa
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManageUnits(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const unit = await prisma.unit.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!unit) return Response.json({ error: "Unidade não encontrada" }, { status: 404 });

  const body = await request.json();
  const input = parseUnitInput(body);
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });

  const duplicate = await prisma.unit.findFirst({ where: { id: { not: id }, name: { equals: input.name, mode: "insensitive" } } });
  if (duplicate) return Response.json({ error: "Já existe uma unidade com este nome" }, { status: 409 });

  const active = typeof body.active === "boolean" ? body.active : unit.active;
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.unit.update({ where: { id }, data: { ...input, active } });
    await tx.auditLog.create({
      data: {
        userId: session.id, action: "UPDATE", entity: "Unit", entityId: id,
        details: JSON.stringify({
          changed: { ...input, active },
          before: {
            name: unit.name, city: unit.city, state: unit.state, address: unit.address, phone: unit.phone, species: unit.species,
            generalRecordEnabled: unit.generalRecordEnabled, serviceOrderEnabled: unit.serviceOrderEnabled, active: unit.active,
          },
        }),
      },
    });
    return u;
  });

  return Response.json(updated);
}
