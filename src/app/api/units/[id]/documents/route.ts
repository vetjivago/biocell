import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { docName, docNotes, parseDueDate, parseVisibility, unitAccess } from "@/lib/unit-documents";

// Novo documento da unidade (além dos padrões: Cartão CNPJ, Contrato Social, Contrato UABC)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const access = await unitAccess(session, id, true);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const name = docName(body.name);
  if (!name) return Response.json({ error: "Informe o nome do documento" }, { status: 400 });
  const dueDate = parseDueDate(body.dueDate ?? null);
  if (dueDate === undefined) return Response.json({ error: "Data de vencimento inválida" }, { status: 400 });

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.unitDocument.create({
      data: {
        unitId: id, kind: "OTHER", name, dueDate, notes: docNotes(body.notes),
        visibility: parseVisibility(body.visibility) ?? "PUBLIC",
        updatedById: session.id,
      },
    });
    await tx.auditLog.create({
      data: { userId: session.id, action: "CREATE", entity: "UnitDocument", entityId: created.id, details: JSON.stringify({ unitId: id, name }) },
    });
    return created;
  });

  return Response.json(doc, { status: 201 });
}
