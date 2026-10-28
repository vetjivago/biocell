import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { MAX_INSTALLMENTS, PAYMENT_METHODS, parseMoney, type SaleItemInput } from "./sales-types";
import { hasRole } from "./roles";

export * from "./sales-types";

// Orçamento/venda acessível pelo usuário (mesma regra do prontuário geral da unidade)
export async function getAccessibleSale(session: SessionUser, saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { unit: { select: { generalRecordEnabled: true } }, items: { orderBy: { position: "asc" } } },
  });
  if (!sale) return { error: "Orçamento não encontrado", status: 404 } as const;
  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(sale.unitId)) {
    return { error: "Sem permissão", status: 403 } as const;
  }
  if (!sale.unit.generalRecordEnabled) return { error: "Orçamentos não habilitados para esta unidade", status: 403 } as const;
  return { sale } as const;
}

// Quem criou, o gestor da unidade ou a matriz podem cancelar, desfazer a venda ou apagar
export function canManageSale(session: SessionUser, sale: { createdById: string }) {
  return sale.createdById === session.id || hasRole(session.role, "ADMIN", "UNIT_MANAGER");
}

function text(v: unknown, max: number) {
  return (typeof v === "string" ? v.trim().slice(0, max) : "") || null;
}

function day(v: unknown): Date | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return "invalid";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

// Datas só de dia, gravadas à meia-noite UTC (exibir com timeZone UTC)
export function todayUTC() {
  return new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}T00:00:00Z`);
}

type QuoteFields = { items?: SaleItemInput[]; validUntil?: Date | null; notes?: string | null; discount?: number };

// Itens, validade, observações e desconto. Em edição (partial) só considera o que veio no corpo
export function parseQuoteFields(body: Record<string, unknown>, { partial = false } = {}): { data: QuoteFields } | { error: string } {
  const data: QuoteFields = {};
  const has = (k: string) => !partial || body[k] !== undefined;

  if (has("items")) {
    if (!Array.isArray(body.items) || body.items.length === 0) return { error: "Adicione pelo menos um item" };
    if (body.items.length > 100) return { error: "Máximo de 100 itens" };
    const items: SaleItemInput[] = [];
    for (const raw of body.items as Record<string, unknown>[]) {
      const description = text(raw?.description, 300);
      const quantity = Number(raw?.quantity);
      const unitPrice = parseMoney(raw?.unitPrice);
      if (!description) return { error: "Informe a descrição de todos os itens" };
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) return { error: `Quantidade inválida em “${description}”` };
      if (unitPrice === null || unitPrice > 100_000_000) return { error: `Valor inválido em “${description}”` };
      items.push({ description, quantity, unitPrice });
    }
    data.items = items;
  }
  if (has("validUntil")) {
    const d = day(body.validUntil);
    if (d === "invalid") return { error: "Data de validade inválida" };
    data.validUntil = d;
  }
  if (has("notes")) data.notes = text(body.notes, 5000);
  if (has("discount")) {
    const d = parseMoney(body.discount);
    if (d === null) return { error: "Desconto inválido" };
    data.discount = d;
  }
  if (data.items && data.discount !== undefined) {
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (data.discount > subtotal) return { error: "O desconto não pode ser maior que o subtotal" };
  }
  return { data };
}

type PaymentFields = { paymentMethod: string; installments: number | null; paymentNotes: string | null; soldAt: Date };

// Forma de pagamento informada ao converter em venda (ou ao corrigi-la depois)
export function parsePayment(body: Record<string, unknown>): { data: PaymentFields } | { error: string } {
  const paymentMethod = text(body.paymentMethod, 100);
  if (!paymentMethod) return { error: "Informe a forma de pagamento" };
  if (!(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) return { error: "Forma de pagamento inválida" };
  let installments: number | null = null;
  if (paymentMethod === "Cartão de crédito" || paymentMethod === "Boleto") {
    const n = Number(body.installments || 1);
    if (!Number.isInteger(n) || n < 1 || n > MAX_INSTALLMENTS) return { error: "Número de parcelas inválido" };
    installments = n;
  }
  const soldAt = day(body.soldAt);
  if (soldAt === "invalid") return { error: "Data da venda inválida" };
  return { data: { paymentMethod, installments, paymentNotes: text(body.paymentNotes, 2000), soldAt: soldAt ?? todayUTC() } };
}
