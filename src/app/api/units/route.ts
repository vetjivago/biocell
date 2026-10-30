import { prisma } from "@/lib/prisma";
import { canManageUnits, seesAllUnits } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { DEFAULT_DOCUMENTS, parseUnitInput } from "@/lib/units";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const isAdmin = seesAllUnits(session.role);
  const units = await prisma.unit.findMany({
    where: isAdmin ? { active: true } : { id: { in: session.unitIds }, active: true },
    select: { id: true, name: true, city: true, state: true, species: true },
    orderBy: { name: "asc" },
  });

  return Response.json(units);
}

// Matriz cadastra uma nova UABC
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManageUnits(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const input = parseUnitInput(await request.json());
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });

  if (await prisma.unit.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } })) {
    return Response.json({ error: "Já existe uma unidade com este nome" }, { status: 409 });
  }

  const unit = await prisma.$transaction(async (tx) => {
    const created = await tx.unit.create({
      data: {
        ...input, organizationId: session.organizationId,
        // Toda unidade começa com os documentos padrão (sem anexos)
        documents: { create: DEFAULT_DOCUMENTS.map((d) => ({ ...d, updatedById: session.id })) },
      },
    });
    await tx.auditLog.create({
      data: { userId: session.id, action: "CREATE", entity: "Unit", entityId: created.id, details: JSON.stringify(input) },
    });
    return created;
  });

  return Response.json(unit, { status: 201 });
}
