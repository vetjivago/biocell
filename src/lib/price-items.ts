import { prisma } from "./prisma";
import { fold, parseMoney, type SaleItemInput } from "./sales-types";

export { fold };

// Itens ativos da tabela de preços que têm valor fixo, pelo nome normalizado
export async function fixedPrices() {
  const items = await prisma.priceItem.findMany({ where: { active: true, price: { not: null } }, select: { name: true, price: true } });
  return new Map(items.map((i) => [fold(i.name), i.price!]));
}

// O valor fixo da tabela vale sobre o que veio do formulário (não dá para alterar na mão)
export async function applyFixedPrices(items: SaleItemInput[]) {
  const fixed = await fixedPrices();
  return items.map((i) => (fixed.has(fold(i.description)) ? { ...i, unitPrice: fixed.get(fold(i.description))! } : i));
}

// Nome e valor do formulário da tabela de preços; valor vazio = preço livre
export function parsePriceItem(body: Record<string, unknown>, { partial = false } = {}) {
  const data: { name?: string; price?: number | null; active?: boolean } = {};
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 200) : "";
    if (!name) return { error: "Informe o nome do item" } as const;
    data.name = name;
  }
  if (!partial || body.price !== undefined) {
    const empty = body.price === null || body.price === undefined || String(body.price).trim() === "";
    const price = empty ? null : parseMoney(body.price);
    if (price === null && !empty) return { error: "Valor inválido" } as const;
    if (price !== null && price > 100_000_000) return { error: "Valor inválido" } as const;
    data.price = price;
  }
  if (typeof body.active === "boolean") data.active = body.active;
  return { data } as const;
}

// Mesmo nome com outra grafia ("Uréia" x "Ureia") conta como repetido
export async function nameTaken(name: string, excludeId?: string) {
  const all = await prisma.priceItem.findMany({ select: { id: true, name: true } });
  return all.some((i) => i.id !== excludeId && fold(i.name) === fold(name));
}
