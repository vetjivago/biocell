// Catálogo padronizado de produtos (pedido da BIO CELL): itens da OS de reposição das UABCs.
// legacy: produtos antigos (SORO/MEIO genéricos) — lotes já existentes seguem válidos, mas não entram em abastecimentos novos.
type Product = {
  id: string;
  name: string;
  code: string;
  category: "CELULAS" | "MEIO" | "SORO" | "MATERIAL";
  species: string | null;
  unit: string;
  presentation?: string;
  legacy?: boolean;
};

export const STANDARD_PRODUCTS: readonly Product[] = [
  { id: "prod_ctm_canino", name: "CTM CANINO", code: "CTM-CAN", category: "CELULAS", species: "Canino", unit: "palhetas", presentation: "Palheta congelada" },
  { id: "prod_ctm_felino", name: "CTM FELINO", code: "CTM-FEL", category: "CELULAS", species: "Felino", unit: "palhetas", presentation: "Palheta congelada" },
  { id: "prod_ctm_equino", name: "CTM EQUINO", code: "CTM-EQU", category: "CELULAS", species: "Equino", unit: "palhetas", presentation: "Palheta congelada" },

  { id: "prod_meio_descongelamento", name: "Meio de descongelamento", code: "MEIO-DESC", category: "MEIO", species: null, unit: "tubos", presentation: "Tubo 10 mL" },
  { id: "prod_meio_lavagem", name: "Meio de lavagem", code: "MEIO-LAV", category: "MEIO", species: null, unit: "tubos", presentation: "Tubo 15 mL" },
  { id: "prod_meio_transporte", name: "Meio de transporte", code: "MEIO-TRANSP", category: "MEIO", species: null, unit: "tubos", presentation: "Tubo 15 mL" },
  { id: "prod_meio", name: "MEIO", code: "MEIO", category: "MEIO", species: null, unit: "unidades", legacy: true },

  { id: "prod_soro_canino", name: "Soro de cão", code: "SORO-CAN", category: "SORO", species: "Canino", unit: "criotubos", presentation: "Criotubo" },
  { id: "prod_soro_felino", name: "Soro de gato", code: "SORO-FEL", category: "SORO", species: "Felino", unit: "criotubos", presentation: "Criotubo" },
  { id: "prod_soro_equino", name: "Soro de equino", code: "SORO-EQU", category: "SORO", species: "Equino", unit: "criotubos", presentation: "Criotubo" },
  { id: "prod_soro", name: "SORO", code: "SORO", category: "SORO", species: null, unit: "unidades", legacy: true },

  { id: "prod_ponteira_azul", name: "Pacote de ponteira Azul", code: "PONT-AZ", category: "MATERIAL", species: null, unit: "pacotes", presentation: "Pct com 10 unidades" },
  { id: "prod_ponteira_amarela", name: "Pacote de ponteira Amarela", code: "PONT-AM", category: "MATERIAL", species: null, unit: "pacotes", presentation: "Pct com 6 unidades" },
  { id: "prod_cateter_16g", name: "Cateter 16G", code: "CAT-16G", category: "MATERIAL", species: null, unit: "unidades", presentation: "Padrão" },
  { id: "prod_agulha_045x13", name: "Agulha 0,45x13mm", code: "AGU-045", category: "MATERIAL", species: null, unit: "unidades", presentation: "Padrão" },
  { id: "prod_seringa_10ml", name: "Seringa BD 10 mL", code: "SER-10", category: "MATERIAL", species: null, unit: "unidades", presentation: "Sem agulha" },
  { id: "prod_seringa_5ml", name: "Seringa BD 5 mL", code: "SER-5", category: "MATERIAL", species: null, unit: "unidades", presentation: "Sem agulha" },
  { id: "prod_seringa_3ml", name: "Seringa BD 3 mL", code: "SER-3", category: "MATERIAL", species: null, unit: "unidades", presentation: "Sem agulha" },
  { id: "prod_seringa_1ml", name: "Seringa BD 1 mL", code: "SER-1", category: "MATERIAL", species: null, unit: "unidades", presentation: "Sem agulha" },
  { id: "prod_etiqueta_seringa", name: "Etiqueta para seringa", code: "ETQ-SER", category: "MATERIAL", species: null, unit: "unidades", presentation: "Logo BIO CELL" },
  { id: "prod_etiqueta_caixa", name: "Etiqueta para caixa", code: "ETQ-CX", category: "MATERIAL", species: null, unit: "unidades", presentation: "Logo BIO CELL" },
  { id: "prod_embalagem_seringa", name: "Embalagem para seringa", code: "EMB-SER", category: "MATERIAL", species: null, unit: "unidades", presentation: "5 cm x 23 cm" },
  { id: "prod_lacinho", name: "Lacinho", code: "LACINHO", category: "MATERIAL", species: null, unit: "unidades", presentation: "Logo BIO CELL" },
  { id: "prod_gravatinha", name: "Gravatinha", code: "GRAVATINHA", category: "MATERIAL", species: null, unit: "unidades", presentation: "Logo BIO CELL" },
  { id: "prod_certificado", name: "Certificado de aplicação", code: "CERT", category: "MATERIAL", species: null, unit: "unidades", presentation: "Padrão BIO CELL" },
  { id: "prod_envelope_ringer", name: "Envelope para ringer", code: "ENV-RING", category: "MATERIAL", species: null, unit: "unidades", presentation: "Logo BIO CELL" },
  { id: "prod_caixa_isopor", name: "Caixa de isopor", code: "CX-ISOPOR", category: "MATERIAL", species: null, unit: "unidades", presentation: "Logo BIO CELL" },
  { id: "prod_tubo_centrifugacao", name: "Tubo para centrifugação", code: "FALCON", category: "MATERIAL", species: null, unit: "unidades", presentation: "Falcon estéril" },
  { id: "prod_ringer_lactato", name: "Ringer com lactato", code: "RINGER", category: "MATERIAL", species: null, unit: "bolsas", presentation: "Bolsa 250 mL" },
  { id: "prod_equipo_fotoprotetor", name: "Equipo fotoprotetor", code: "EQUIPO", category: "MATERIAL", species: null, unit: "unidades", presentation: "Padrão" },
];

export type ProductCategory = Product["category"];

// Grupos usados no abastecimento, no prontuário e na baixa
export const PRODUCT_CATEGORIES: { key: ProductCategory; label: string; unit: string }[] = [
  { key: "CELULAS", label: "Células", unit: "palhetas" },
  { key: "SORO", label: "Soro", unit: "un." },
  { key: "MEIO", label: "Meio", unit: "un." },
  { key: "MATERIAL", label: "Materiais", unit: "un." },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(PRODUCT_CATEGORIES.map((c) => [c.key, c.label]));

// Materiais não têm lote: ficam todos num "lote" único
export const NO_LOT = "SEM LOTE";

export function lotLabel(batchNumber: string, productName: string) {
  return batchNumber === NO_LOT ? productName : `${productName} – Lote ${batchNumber}`;
}

export function standardProduct(id: unknown) {
  return STANDARD_PRODUCTS.find((p) => p.id === id) ?? null;
}

// Produto padrão equivalente a um produto antigo (pela categoria e espécie)
export function standardFor(category: string, species: string | null) {
  if (category === "SORO") return standardProduct("prod_soro");
  if (category === "MEIO") return standardProduct("prod_meio");
  return STANDARD_PRODUCTS.find((p) => p.category === "CELULAS" && p.species === species) ?? null;
}

// Lote sem espaços sobrando ("05.004.25 LT 021225.1 " = "05.004.25 LT 021225.1")
export function normalizeBatchNumber(v: string) {
  return v.trim().replace(/\s+/g, " ");
}
