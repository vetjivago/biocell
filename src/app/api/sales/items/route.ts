import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasRole } from "@/lib/roles";

// Sem acento e minúsculo: "celula" encontra "Célula-tronco"
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

// Sugestões de itens já usados em orçamentos das unidades do usuário (com o último valor cobrado)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const q = fold((request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100));
  const recent = await prisma.saleItem.findMany({
    where: { sale: hasRole(session.role, "ADMIN") ? {} : { unitId: { in: session.unitIds } } },
    orderBy: { sale: { createdAt: "desc" } },
    select: { description: true, unitPrice: true },
    take: 2000,
  });

  // Mais recente primeiro: o valor sugerido é o último cobrado
  const seen = new Map<string, { description: string; unitPrice: number }>();
  for (const i of recent) {
    const key = fold(i.description);
    if (!seen.has(key) && (!q || key.includes(q))) seen.set(key, i);
  }
  const items = [...seen.values()].sort((a, b) => a.description.localeCompare(b.description, "pt-BR")).slice(0, 30);
  return Response.json({ items });
}
