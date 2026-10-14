// Espécies padronizadas do sistema
export const SPECIES = ["Canino", "Felino", "Equino"] as const;
export type Species = (typeof SPECIES)[number];

// Reconhece variações ("Cão", "CTM gato", "equinas"...) e devolve a espécie padronizada
export function normalizeSpecies(text: string | null | undefined): Species | null {
  const t = (text || "").toLowerCase();
  if (/c[aã]o|canin/.test(t)) return "Canino";
  if (/gato|felin/.test(t)) return "Felino";
  if (/equin|caval/.test(t)) return "Equino";
  return null;
}
