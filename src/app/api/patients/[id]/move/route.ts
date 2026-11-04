import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { NextRequest } from "next/server";

// Move o paciente para outra UABC — só a matriz (perfil ADMIN).
// Muda a unidade do cadastro: os próximos atendimentos já são da nova unidade e a equipe dela passa a ver
// a ficha completa. Prontuários, OS, vendas e baixas de estoque antigos continuam na unidade onde aconteceram.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!hasRole(session.role, "ADMIN")) return Response.json({ error: "Só a matriz pode mover pacientes" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const unitId = typeof body?.unitId === "string" ? body.unitId : "";

  const patient = await prisma.patient.findUnique({ where: { id }, select: { unitId: true, unit: { select: { name: true } } } });
  if (!patient) return Response.json({ error: "Paciente não encontrado" }, { status: 404 });
  if (unitId === patient.unitId) return Response.json({ error: "O paciente já está nesta unidade" }, { status: 400 });

  const target = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true, name: true, active: true } });
  if (!target || !target.active) return Response.json({ error: "Unidade de destino inválida" }, { status: 400 });

  await prisma.$transaction([
    prisma.patient.update({ where: { id }, data: { unitId: target.id } }),
    prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "MOVE",
        entity: "Patient",
        entityId: id,
        details: JSON.stringify({ from: { id: patient.unitId, name: patient.unit.name }, to: { id: target.id, name: target.name } }),
      },
    }),
  ]);

  return Response.json({ ok: true, unitId: target.id, unitName: target.name });
}
