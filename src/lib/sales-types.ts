// Constantes de orçamentos e vendas (sem dependências de servidor: usadas também no navegador)

export const SALE_STATUS: Record<string, { label: string; cls: string }> = {
  QUOTE: { label: "Orçamento", cls: "bg-blue-100 text-blue-700" },
  SALE: { label: "Venda", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-600" },
};

export const SALE_COLOR = "#0e7490";

export const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Transferência bancária",
  "A combinar",
] as const;

export const MAX_INSTALLMENTS = 24;
// Validade padrão de um orçamento novo
export const DEFAULT_VALIDITY_DAYS = 30;

// AAAA-MM-DD, DEFAULT_VALIDITY_DAYS dias a partir de hoje (horário de Brasília)
export function defaultValidUntil() {
  return new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export type SaleItemInput = { description: string; quantity: number; unitPrice: number };

// Valores em centavos
export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Valor sem o "R$" (para campos de digitação): 900,00
export function formatMoneyInput(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Aceita "900", "900,5", "1.234,56", "R$ 1234.56"; retorna centavos ou null se inválido
export function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  let s = String(v ?? "").replace(/R\$|\s/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function saleTotals(sale: { discount: number; items: { quantity: number; unitPrice: number }[] }) {
  const subtotal = sale.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  return { subtotal, discount: sale.discount, total: Math.max(0, subtotal - sale.discount) };
}

// Nº exibido: 0042
export function saleNumber(n: number) {
  return String(n).padStart(4, "0");
}

export function paymentLabel(method: string | null, installments: number | null) {
  if (!method) return "";
  return installments && installments > 1 ? `${method} em ${installments}x` : method;
}
