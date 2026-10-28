import { prisma } from "./prisma";
import { hasRole } from "./roles";

// Regras das aplicações do prontuário CT (usadas ao criar e ao editar)

type AppItemInput = { batchId?: string; category?: string; quantity?: number | string };
type AppInput = { id?: string; number: number; date?: string | null; preparedBy?: string | null; cells?: string; serum?: string; medium?: string; items?: AppItemInput[] };
type ThawInput = { number: number; thawedStraws?: number | string | null; thawedMeio?: number | string | null; thawedSoro?: number | string | null; retrievalLocation?: string | null };

export type ParsedItem = { batchId: string; category: string; quantity: number };
export type ParsedApp = { id?: string; number: number; date?: string | null; preparedBy: string | null; cells?: string; serum?: string; medium?: string; items: ParsedItem[] };
export type BatchInfo = Map<string, { batchNumber: string; category: string; productName: string }>;

export function parseApplications(applications: unknown): ParsedApp[] {
  const list = Array.isArray(applications) ? (applications as AppInput[]) : [];
  return list
    .map((a) => ({
      ...a,
      number: Math.max(1, Math.floor(Number(a.number) || 1)),
      preparedBy: cleanPreparedBy(a.preparedBy),
      items: (a.items || [])
        .filter((i) => i.batchId && Number(i.quantity) > 0)
        .map((i) => ({ batchId: i.batchId as string, category: i.category || "CELULAS", quantity: Math.floor(Number(i.quantity)) })),
    }))
    .filter((a) => a.date || a.cells || a.items.length > 0);
}

export function cleanPreparedBy(v: unknown) {
  return typeof v === "string" ? v.trim().slice(0, 120) || null : null;
}

// Exigências da BIO CELL em cada aplicação: lote do soro identificado e responsável pelo preparo
export function checkApplications(apps: ParsedApp[]): string | null {
  for (const a of apps) {
    if (!a.items.some((i) => i.category === "SORO")) return `${a.number}ª aplicação: informe o lote do soro`;
    if (!a.preparedBy) return `${a.number}ª aplicação: informe o responsável pelo preparo`;
  }
  return null;
}

// Lotes precisam estar no estoque da unidade, ser da categoria certa e ter saldo suficiente
export async function validateLots(apps: ParsedApp[], unitId: string): Promise<{ batchInfo: BatchInfo } | { error: string }> {
  const requested = new Map<string, number>();
  for (const item of apps.flatMap((a) => a.items)) requested.set(item.batchId, (requested.get(item.batchId) || 0) + item.quantity);
  const batchInfo: BatchInfo = new Map();
  if (requested.size === 0) return { batchInfo };

  const ids = [...requested.keys()];
  const [batches, balances] = await Promise.all([
    prisma.cellBatch.findMany({ where: { id: { in: ids } }, include: { product: { select: { name: true, category: true } } } }),
    prisma.inventoryTransaction.groupBy({ by: ["batchId"], _sum: { quantity: true }, where: { unitId, batchId: { in: ids } } }),
  ]);
  for (const b of batches) batchInfo.set(b.id, { batchNumber: b.batchNumber, category: b.product.category, productName: b.product.name });
  const balance = new Map(balances.map((b) => [b.batchId, b._sum.quantity || 0]));

  for (const item of apps.flatMap((a) => a.items)) {
    const info = batchInfo.get(item.batchId);
    if (!info || info.category !== item.category) return { error: "Lote inválido selecionado na aplicação" };
  }
  for (const [batchId, qty] of requested) {
    const available = balance.get(batchId) || 0;
    if (qty > available) {
      const info = batchInfo.get(batchId)!;
      return { error: `Estoque insuficiente do lote ${info.batchNumber} (${info.productName}). Disponível: ${available}, solicitado: ${qty}` };
    }
  }
  return { batchInfo };
}

// Resumo em texto (mantém compatibilidade com a exibição/impressão existente)
export function summarize(items: ParsedItem[], category: string, batchInfo: BatchInfo, fallback?: string) {
  const rows = items.filter((i) => i.category === category);
  if (rows.length === 0) return fallback || null;
  return rows.map((i) => `${i.quantity} (lote ${batchInfo.get(i.batchId)?.batchNumber})`).join(" + ");
}

export function parseThawings(thawings: unknown) {
  const list = Array.isArray(thawings) ? (thawings as ThawInput[]) : [];
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Math.max(0, Math.floor(Number(v)) || 0) || null);
  return list
    .map((t) => ({
      number: Math.max(1, Math.floor(Number(t.number) || 1)),
      thawedStraws: num(t.thawedStraws),
      thawedMeio: num(t.thawedMeio),
      thawedSoro: num(t.thawedSoro),
      retrievalLocation: typeof t.retrievalLocation === "string" ? t.retrievalLocation.trim().slice(0, 200) || null : null,
    }))
    .filter((t) => t.thawedStraws || t.thawedMeio || t.thawedSoro || t.retrievalLocation);
}

// Quem pode alterar/excluir: quem registrou, o gestor da unidade ou a matriz
export function canEditRecord(session: { id: string; role: string }, record: { professionalId: string }) {
  return record.professionalId === session.id || hasRole(session.role, "ADMIN", "UNIT_MANAGER");
}
