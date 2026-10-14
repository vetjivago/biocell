// Catálogo padronizado de produtos (pedido da BIO CELL): só estes 5 existem no abastecimento
export const STANDARD_PRODUCTS = [
  { id: "prod_ctm_canino", name: "CTM CANINO", code: "CTM-CAN", category: "CELULAS", species: "Canino", unit: "palhetas" },
  { id: "prod_ctm_felino", name: "CTM FELINO", code: "CTM-FEL", category: "CELULAS", species: "Felino", unit: "palhetas" },
  { id: "prod_ctm_equino", name: "CTM EQUINO", code: "CTM-EQU", category: "CELULAS", species: "Equino", unit: "palhetas" },
  { id: "prod_soro", name: "SORO", code: "SORO", category: "SORO", species: null, unit: "unidades" },
  { id: "prod_meio", name: "MEIO", code: "MEIO", category: "MEIO", species: null, unit: "unidades" },
] as const;

export type StandardProductId = (typeof STANDARD_PRODUCTS)[number]["id"];

export function standardProduct(id: unknown) {
  return STANDARD_PRODUCTS.find((p) => p.id === id) ?? null;
}

// Produto padrão equivalente a um produto antigo (pela categoria e espécie)
export function standardFor(category: string, species: string | null) {
  if (category === "SORO") return STANDARD_PRODUCTS[3];
  if (category === "MEIO") return STANDARD_PRODUCTS[4];
  return STANDARD_PRODUCTS.find((p) => p.category === "CELULAS" && p.species === species) ?? null;
}

// Lote sem espaços sobrando ("05.004.25 LT 021225.1 " = "05.004.25 LT 021225.1")
export function normalizeBatchNumber(v: string) {
  return v.trim().replace(/\s+/g, " ");
}
