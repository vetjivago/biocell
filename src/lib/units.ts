import { SPECIES } from "@/lib/species";

// Estados do cadastro de unidades ("EXT" = unidade fora do Brasil)
export const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO", "EXT",
] as const;

export interface UnitInput {
  name: string;
  city: string;
  state: string;
  address: string | null;
  phone: string | null;
  species: string;
  generalRecordEnabled: boolean;
  serviceOrderEnabled: boolean;
}

function text(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

// Valida o corpo enviado pela tela de unidade (criação e edição)
export function parseUnitInput(body: Record<string, unknown>): UnitInput | { error: string } {
  const name = text(body.name, 120).toUpperCase();
  const city = text(body.city, 80);
  const state = text(body.state, 3).toUpperCase();
  const species = Array.isArray(body.species) ? SPECIES.filter((s) => (body.species as unknown[]).includes(s)) : [];

  if (!name) return { error: "Informe o nome da unidade" };
  if (!city) return { error: "Informe a cidade" };
  if (!(STATES as readonly string[]).includes(state)) return { error: "Estado inválido" };
  if (species.length === 0) return { error: "Escolha ao menos uma espécie atendida" };

  return {
    name, city, state,
    address: text(body.address, 250) || null,
    phone: text(body.phone, 40) || null,
    species: species.join(", "),
    generalRecordEnabled: body.generalRecordEnabled === true,
    serviceOrderEnabled: body.serviceOrderEnabled === true,
  };
}
