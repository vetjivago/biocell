// Loja de compras das UABCs: o mesmo catálogo da loja da BIO CELL no Sults (fotos em /public/loja).
// Sem dependências de servidor: a vitrine e o carrinho rodam no navegador.
import type { RackKey } from "./purchase-orders";

export type StoreCategory = "BIOLOGICOS" | "INSUMO" | "APOIO" | "MARKETING";

export const STORE_CATEGORIES: { key: StoreCategory; label: string; cls: string }[] = [
  { key: "BIOLOGICOS", label: "Produtos Biológicos", cls: "bg-emerald-100 text-emerald-800" },
  { key: "INSUMO", label: "Insumo", cls: "bg-sky-100 text-sky-800" },
  { key: "APOIO", label: "Material de Apoio", cls: "bg-amber-100 text-amber-800" },
  { key: "MARKETING", label: "Material de Marketing", cls: "bg-rose-100 text-rose-800" },
];

// O que entra no estoque da unidade quando o item é enviado (produto do catálogo do estoque × quantidade)
type Stock = { productId: string; qty: number }[];
type Variant = { key: string; label: string; stock?: Stock };

export type StoreProduct = {
  id: string;
  name: string;
  category: StoreCategory;
  price: number; // centavos
  image?: string;
  subtitle?: string;
  description?: string[];
  rack?: RackKey; // raque de células: vira raques do pedido (e o kit da OS é calculado)
  variantLabel?: string;
  variants?: Variant[];
  stock?: Stock;
};

const meio = (key: string, label: string): Variant => ({ key, label, stock: [{ productId: `prod_meio_${key}`, qty: 1 }] });
const seringa = (ml: number): Variant => ({
  key: `${ml}ml`, label: `${ml} mL`,
  stock: [{ productId: `prod_seringa_${ml}ml`, qty: 1 }, { productId: "prod_agulha_045x13", qty: 1 }],
});
const kit = (key: string, label: string, soro: string): Variant => ({
  key, label,
  stock: [
    { productId: "prod_meio_descongelamento", qty: 1 },
    { productId: "prod_meio_lavagem", qty: 1 },
    { productId: "prod_meio_transporte", qty: 1 },
    { productId: soro, qty: 2 },
  ],
});
const RACK_NOTE = "Mínimo de 48 palhetas. Não obrigatório ser da mesma espécie";

export const STORE_PRODUCTS: StoreProduct[] = [
  { id: "raque-cao", name: "Raque de célula-tronco cão (16 palhetas)", category: "BIOLOGICOS", price: 273600, image: "/loja/raque-cao.jpg", subtitle: RACK_NOTE, rack: "racksCanine" },
  { id: "raque-gato", name: "Raque de célula-tronco gato (8 palhetas)", category: "BIOLOGICOS", price: 136800, image: "/loja/raque-gato.jpg", subtitle: RACK_NOTE, rack: "racksFeline" },
  { id: "raque-cavalo", name: "Raque de célula-tronco cavalo (16 palhetas)", category: "BIOLOGICOS", price: 273600, image: "/loja/raque-cavalo.jpg", subtitle: RACK_NOTE, rack: "racksEquine" },
  {
    id: "almofada-equino", name: "Almofada Equino", category: "MARKETING", price: 2250, image: "/loja/almofada-equino.jpg",
    variantLabel: "Cor", variants: [{ key: "palomino", label: "Palomino" }, { key: "castanho", label: "Castanho" }],
  },
  { id: "almofada-bia-cell", name: "Almofada BIA CELL", category: "MARKETING", price: 2250, image: "/loja/almofada-bia-cell.jpg" },
  { id: "almofada-mia-cell", name: "Almofada MIA CELL", category: "MARKETING", price: 2250, image: "/loja/almofada-mia-cell.jpg" },
  { id: "certificado", name: "Certificado de aplicação impresso", category: "APOIO", price: 240, image: "/loja/certificado.jpg", stock: [{ productId: "prod_certificado", qty: 1 }] },
  { id: "embalagem-seringa", name: "Conjunto de embalagem para seringa (10 unidades)", category: "INSUMO", price: 135, image: "/loja/embalagem-seringa.jpg", stock: [{ productId: "prod_embalagem_seringa", qty: 10 }] },
  { id: "ponteira-amarela", name: "Pacote de ponteiras amarelas autoclavadas (6 unidades)", category: "INSUMO", price: 340, image: "/loja/ponteira-amarela.jpg", stock: [{ productId: "prod_ponteira_amarela", qty: 1 }] },
  { id: "ponteira-azul", name: "Pacote de ponteiras azuis autoclavadas (10 unidades)", category: "INSUMO", price: 260, image: "/loja/ponteira-azul.jpg", stock: [{ productId: "prod_ponteira_azul", qty: 1 }] },
  { id: "folder-cao-gato", name: "Folder institucional de cão e gato impresso", category: "MARKETING", price: 430, image: "/loja/folder-cao-gato.jpg" },
  { id: "folder-equino", name: "Folder institucional de equino impresso", category: "MARKETING", price: 430, image: "/loja/folder-equino.jpg" },
  { id: "cateter-16g", name: "Cateter Periférico Intravenoso 16G", category: "INSUMO", price: 455, image: "/loja/cateter-16g.jpg", stock: [{ productId: "prod_cateter_16g", qty: 1 }] },
  {
    id: "aliquota-soro", name: "Alíquota para meios (Soro animal)", category: "INSUMO", price: 500, image: "/loja/aliquota-soro.jpg",
    variantLabel: "Espécies",
    variants: [
      { key: "cao", label: "Cão", stock: [{ productId: "prod_soro_canino", qty: 1 }] },
      { key: "gato", label: "Gato", stock: [{ productId: "prod_soro_felino", qty: 1 }] },
      { key: "equino", label: "Equino", stock: [{ productId: "prod_soro_equino", qty: 1 }] },
    ],
  },
  {
    id: "kit-afiliados", name: "Kit para afiliados", category: "MARKETING", price: 8350,
    description: ["Kit composto por:", "01 Porta panfletos", "01 Plaquinha com QR Code em L", "01 Placa com QR Code para mesa", "50 Panfletos"],
  },
  {
    id: "meios-extras", name: "Meios (extras)", category: "INSUMO", price: 625, image: "/loja/meios-extras.jpg",
    variantLabel: "Meio de", variants: [meio("descongelamento", "Descongelamento"), meio("lavagem", "Lavagem"), meio("transporte", "Transporte")],
  },
  {
    id: "seringa-agulha", name: "Seringa + Agulha 0,45mm", category: "INSUMO", price: 200, image: "/loja/seringa-agulha.jpg",
    variantLabel: "Volume", variants: [seringa(1), seringa(3), seringa(5), seringa(10)],
  },
  {
    id: "kit-descongelamento", name: "Kit de descongelamento (extra)", category: "INSUMO", price: 3125, image: "/loja/kit-descongelamento.jpg",
    subtitle: "Composto por 06 itens",
    description: ["Composto por:", "01 meio de descongelamento", "01 meio de lavagem", "01 meio de transporte", "02 alíquotas de lavagem e transporte (soro animal)", "Ponteiras (azul e amarela)"],
    variantLabel: "Espécie dos soros",
    variants: [kit("canino", "Canino", "prod_soro_canino"), kit("felino", "Felino", "prod_soro_felino"), kit("equino", "Equino", "prod_soro_equino")],
  },
  { id: "caixa-isopor", name: "Caixa de isopor personalizada", category: "INSUMO", price: 940, image: "/loja/caixa-isopor.jpg", stock: [{ productId: "prod_caixa_isopor", qty: 1 }] },
  { id: "equipo", name: "Equipo fotoprotetor", category: "INSUMO", price: 760, image: "/loja/equipo.jpg", stock: [{ productId: "prod_equipo_fotoprotetor", qty: 1 }] },
  { id: "ringer", name: "Ringer com lactato 250ml", category: "INSUMO", price: 900, image: "/loja/ringer.jpg", stock: [{ productId: "prod_ringer_lactato", qty: 1 }] },
];

export function storeProduct(id: unknown) {
  return STORE_PRODUCTS.find((p) => p.id === id) ?? null;
}

export function variantOf(p: StoreProduct, key: string | null | undefined) {
  return p.variants?.find((v) => v.key === key) ?? null;
}

export function lineName(p: StoreProduct, variantKey?: string | null) {
  const v = variantOf(p, variantKey);
  return v ? `${p.name} — ${p.variantLabel}: ${v.label}` : p.name;
}

export type CartLine = { productId: string; variant: string | null; quantity: number };

// Valida uma linha vinda do carrinho; devolve null se o produto/variação não existir
export function parseCartLine(v: unknown): CartLine | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const p = storeProduct(o.productId);
  if (!p) return null;
  const quantity = Math.min(9999, Math.max(0, Math.trunc(Number(o.quantity) || 0)));
  if (!quantity) return null;
  const variant = typeof o.variant === "string" ? o.variant : null;
  if (p.variants ? !variantOf(p, variant) : variant) return null;
  return { productId: p.id, variant: p.variants ? variant : null, quantity };
}

// Itens do estoque que a linha acrescenta como "pedido extra" na OS
export function lineStock(line: CartLine): Stock {
  const p = storeProduct(line.productId);
  if (!p) return [];
  const base = p.variants ? variantOf(p, line.variant)?.stock : p.stock;
  return (base ?? []).map((s) => ({ productId: s.productId, qty: s.qty * line.quantity }));
}
