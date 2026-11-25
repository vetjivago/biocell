// Pedidos de compra das UABCs (no lugar da loja do Sults).
// Sem dependências de servidor: o cálculo roda também no navegador, enquanto a unidade monta o pedido.
import { hasRole } from "./roles";
import { standardProduct } from "./products";

// ── Regra da OS de reposição (planilha "OS EDITÁVEL 2026" / OS de out/2026) ─────────────────
// Raque: cão 16 palhetas, gato 8, equino 16
export const RACKS = [
  { key: "racksCanine", productId: "prod_ctm_canino", label: "Cão", strawsPerRack: 16, strawsPerKit: 6, serumId: "prod_soro_canino" },
  { key: "racksFeline", productId: "prod_ctm_felino", label: "Gato", strawsPerRack: 8, strawsPerKit: 5, serumId: "prod_soro_felino" },
  { key: "racksEquine", productId: "prod_ctm_equino", label: "Equino", strawsPerRack: 16, strawsPerKit: 7, serumId: "prod_soro_equino" },
] as const;
export type RackKey = (typeof RACKS)[number]["key"];
export type Racks = Record<RackKey, number>;

// Pedido de células: zero (só materiais) ou no mínimo 48 palhetas, de qualquer espécie (regra do Sults)
export const MIN_STRAWS = 48;

// Itens da OS na ordem da planilha. "kits" = quantos kits de aplicação as palhetas rendem
// (palhetas de cão ÷ 6 + gato ÷ 5 + equino ÷ 7, contando o estoque + as que vão).
// Cada item tem a meta da unidade; vai a meta menos o estoque (arredondado para cima, nunca negativo).
type Target = { kind: "kits"; factor: number } | { kind: "fixed"; value: number } | { kind: "serum"; rack: RackKey } | { kind: "onRequest" };
export const ORDER_ITEMS: { productId: string; target: Target }[] = [
  { productId: "prod_meio_descongelamento", target: { kind: "kits", factor: 1 } },
  { productId: "prod_meio_lavagem", target: { kind: "kits", factor: 1 } },
  { productId: "prod_meio_transporte", target: { kind: "kits", factor: 1 } },
  { productId: "prod_ponteira_azul", target: { kind: "kits", factor: 1 } },
  { productId: "prod_ponteira_amarela", target: { kind: "kits", factor: 1 } },
  { productId: "prod_cateter_16g", target: { kind: "kits", factor: 1 } },
  { productId: "prod_agulha_045x13", target: { kind: "kits", factor: 3 } },
  { productId: "prod_seringa_10ml", target: { kind: "kits", factor: 1 } },
  { productId: "prod_seringa_5ml", target: { kind: "kits", factor: 1 } },
  { productId: "prod_seringa_3ml", target: { kind: "kits", factor: 1 } },
  { productId: "prod_seringa_1ml", target: { kind: "kits", factor: 3 } },
  { productId: "prod_etiqueta_seringa", target: { kind: "kits", factor: 3 } },
  { productId: "prod_etiqueta_caixa", target: { kind: "kits", factor: 1 } },
  { productId: "prod_embalagem_seringa", target: { kind: "kits", factor: 1 } },
  { productId: "prod_lacinho", target: { kind: "kits", factor: 1 } },
  { productId: "prod_gravatinha", target: { kind: "kits", factor: 1 } },
  { productId: "prod_certificado", target: { kind: "kits", factor: 1 } },
  { productId: "prod_ctm_canino", target: { kind: "onRequest" } },
  { productId: "prod_ctm_felino", target: { kind: "onRequest" } },
  { productId: "prod_ctm_equino", target: { kind: "onRequest" } },
  { productId: "prod_soro_canino", target: { kind: "serum", rack: "racksCanine" } },
  { productId: "prod_soro_felino", target: { kind: "serum", rack: "racksFeline" } },
  { productId: "prod_soro_equino", target: { kind: "serum", rack: "racksEquine" } },
  { productId: "prod_envelope_ringer", target: { kind: "kits", factor: 1 } },
  { productId: "prod_caixa_isopor", target: { kind: "onRequest" } },
  { productId: "prod_tubo_centrifugacao", target: { kind: "fixed", value: 5 } },
  { productId: "prod_ringer_lactato", target: { kind: "onRequest" } },
  { productId: "prod_equipo_fotoprotetor", target: { kind: "onRequest" } },
];

const CELL_IDS: string[] = RACKS.map((r) => r.productId);
export const isCellItem = (productId: string) => CELL_IDS.includes(productId);

// Arredonda para cima, com folga para erro de ponto flutuante (16,000001 → 16)
const ceil = (n: number) => Math.max(0, Math.ceil(n - 1e-9));

export type CalcItem = { productId: string; stock: number; calculated: number; onRequest: boolean };

export function strawsOf(racks: Racks) {
  return RACKS.reduce((s, r) => s + (racks[r.key] || 0) * r.strawsPerRack, 0);
}

// stock: saldo da unidade por produto (palhetas de treino e produtos antigos não entram)
export function calculateOrder(stock: Record<string, number>, racks: Racks) {
  const total = (r: (typeof RACKS)[number]) => Math.max(0, stock[r.productId] || 0) + (racks[r.key] || 0) * r.strawsPerRack;
  const kits = RACKS.reduce((s, r) => s + total(r) / r.strawsPerKit, 0);
  const items: CalcItem[] = ORDER_ITEMS.map(({ productId, target }) => {
    const have = Math.max(0, stock[productId] || 0);
    const rack = RACKS.find((r) => r.productId === productId);
    let calculated = 0;
    if (rack) calculated = (racks[rack.key] || 0) * rack.strawsPerRack;
    else if (target.kind === "kits") calculated = ceil(kits * target.factor - have);
    else if (target.kind === "fixed") calculated = ceil(target.value - have);
    else if (target.kind === "serum") {
      const r = RACKS.find((x) => x.key === target.rack)!;
      calculated = ceil((total(r) / r.strawsPerKit) * 2 - have);
    }
    return { productId, stock: have, calculated, onRequest: target.kind === "onRequest" && !rack };
  });
  return { kits, items };
}

// ── Preços (centavos), pela planilha "MATRIZ OS EDITÁVEL 2026" ───────────────────────────
export const STRAW_PRICE = 17100; // R$ 171,00 por palheta (raque de cão R$ 2.736,00)
export const DRY_ICE_PRICE = 4750; // R$ 47,50 por unidade de gelo seco
// Itens cobrados pela quantidade enviada; o resto do material vai sem custo, e o que for
// cobrado à parte (meios e soros extras etc.) a matriz lança no campo "Extra"
export const ITEM_PRICES: Record<string, number> = {
  prod_caixa_isopor: 940,
  prod_ringer_lactato: 900,
  prod_equipo_fotoprotetor: 760,
};

type PricedItem = { productId: string; quantity: number };
type PricedLine = { storeId: string; quantity: number; unitPrice: number };

// Pedido da loja: cobra as células (pelo que vai) + o carrinho (preço do dia, sem as raques).
// Pedido antigo (sem carrinho): cobra isopor, ringer e equipo pela quantidade enviada, como a planilha
export function orderTotals(o: { items: PricedItem[]; lines?: PricedLine[]; dryIce: boolean; dryIceQty: number; freight: number; extraValue: number; discount: number }) {
  const qty = (id: string) => o.items.filter((i) => i.productId === id).reduce((s, i) => s + i.quantity, 0);
  const cells = o.items.filter((i) => isCellItem(i.productId)).reduce((s, i) => s + i.quantity, 0) * STRAW_PRICE;
  const fromStore = !!o.lines?.length;
  const cart = fromStore ? o.lines!.filter((l) => !l.storeId.startsWith("raque-")).reduce((s, l) => s + l.quantity * l.unitPrice, 0) : 0;
  const box = fromStore ? 0 : qty("prod_caixa_isopor") * ITEM_PRICES.prod_caixa_isopor;
  const ringer = fromStore ? 0 : qty("prod_ringer_lactato") * ITEM_PRICES.prod_ringer_lactato;
  const equipo = fromStore ? 0 : qty("prod_equipo_fotoprotetor") * ITEM_PRICES.prod_equipo_fotoprotetor;
  const dryIce = o.dryIce ? o.dryIceQty * DRY_ICE_PRICE : 0;
  const total = cells + cart + box + ringer + equipo + dryIce + o.freight + o.extraValue - o.discount;
  return { cells, cart, box, ringer, equipo, dryIce, total };
}

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Situação e permissões ───────────────────────────────────────────────────────────────────
export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  WAITING: { label: "Aguardando", cls: "bg-amber-100 text-amber-800" },
  INVOICED: { label: "Faturado", cls: "bg-blue-100 text-blue-700" },
  SHIPPED: { label: "Enviado", cls: "bg-indigo-100 text-indigo-700" },
  DELIVERED: { label: "Entregue", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-600" },
};

export const SHIPPING_MODES = ["TERRESTRE", "AÉREA", "RETIRADA"];
export const PAYMENT_METHODS = ["BOLETO", "PIX", "TRANSFERÊNCIA", "CARTÃO"];

// Matriz e logística recebem, faturam e enviam os pedidos de todas as unidades
export function canProcessPurchases(role: string) {
  return hasRole(role, "ADMIN", "STOCK");
}

// Gestor faz o pedido das suas unidades; a matriz também pode lançar por uma unidade
export function canRequestPurchases(role: string) {
  return hasRole(role, "ADMIN", "STOCK", "UNIT_MANAGER");
}

// Quem enxerga a tela de pedidos (administrativo e comercial só consultam)
export function canViewPurchases(role: string) {
  return canRequestPurchases(role) || hasRole(role, "ADMINISTRATIVE", "COMMERCIAL");
}

// Quem é avisado de pedido novo: contador no menu e e-mail
export const NOTIFY_ROLES = ["ADMIN", "STOCK", "ADMINISTRATIVE", "COMMERCIAL"] as const;
export function seesWaitingPurchases(role: string) {
  return hasRole(role, ...NOTIFY_ROLES);
}

export type Lot = { batchNumber: string; quantity: number };

export function parseLots(v: unknown): Lot[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((l) => ({ batchNumber: String(l?.batchNumber ?? "").trim().replace(/\s+/g, " ").slice(0, 80), quantity: Math.trunc(Number(l?.quantity) || 0) }))
    .filter((l) => l.batchNumber || l.quantity);
}

// Itens com lote obrigatório no envio (células, meios e soros; materiais não têm lote)
export function needsLot(productId: string) {
  const p = standardProduct(productId);
  return !!p && p.category !== "MATERIAL";
}
