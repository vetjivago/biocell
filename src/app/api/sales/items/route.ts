import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasRole } from "@/lib/roles";
import { fold } from "@/lib/price-items";

type Suggestion = { description: string; unitPrice: number; fixed: boolean; catalog: boolean };

// Sugestões para o orçamento: primeiro a tabela de preços da matriz (com valor fixo, travado),
// depois os itens já usados em orçamentos das unidades do usuário (com o último valor cobrado).
// Sem busca: só a tabela de preços (os mais usados)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const q = fold((request.nextUrl.searchParams.get("q") || "").slice(0, 100));
  const catalog = await prisma.priceItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true, price: true } });

  const seen = new Map<string, Suggestion>();
  for (const c of catalog) {
    if (!q || fold(c.name).includes(q)) seen.set(fold(c.name), { description: c.name, unitPrice: c.price ?? 0, fixed: c.price !== null, catalog: true });
  }
  const fromCatalog = [...seen.values()];
  if (!q) return Response.json({ items: fromCatalog });

  const recent = await prisma.saleItem.findMany({
    where: { sale: hasRole(session.role, "ADMIN") ? {} : { unitId: { in: session.unitIds } } },
    orderBy: { sale: { createdAt: "desc" } },
    select: { description: true, unitPrice: true },
    take: 2000,
  });
  // Mais recente primeiro: o valor sugerido é o último cobrado. Item da tabela sem valor fixo usa o último valor
  const history: Suggestion[] = [];
  for (const i of recent) {
    const key = fold(i.description);
    if (!key.includes(q)) continue;
    const c = seen.get(key);
    if (c) {
      if (!c.fixed && !c.unitPrice) c.unitPrice = i.unitPrice;
      continue;
    }
    const s = { description: i.description, unitPrice: i.unitPrice, fixed: false, catalog: false };
    seen.set(key, s);
    history.push(s);
  }
  history.sort((a, b) => a.description.localeCompare(b.description, "pt-BR"));
  return Response.json({ items: [...fromCatalog, ...history].slice(0, 30) });
}
