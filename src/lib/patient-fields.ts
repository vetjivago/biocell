import { normalizeSpecies } from "./species";

export const SEX_OPTIONS = ["Macho", "Fêmea"] as const;

// Idade a partir da data de nascimento ("9 anos, 1 mês"), como no SimplesVet
export function formatAge(birth: Date | null | undefined, now = new Date()) {
  if (!birth) return null;
  let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (now.getUTCMonth() - birth.getUTCMonth());
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? "ano" : "anos"}`);
  if (m > 0 || y === 0) parts.push(`${m} ${m === 1 ? "mês" : "meses"}`);
  return parts.join(", ");
}

const PATIENT_TEXT_FIELDS = {
  name: 120, breed: 120, ownerName: 160, ownerPhone: 40, ownerEmail: 160,
  veterinarian: 160, clinic: 160, coat: 80, microchip: 40, ownerAddress: 300,
} as const;

// Normaliza os campos do cadastro do paciente (criação e edição)
export function parsePatientFields(body: Record<string, unknown>, { partial = false } = {}) {
  const data: Record<string, unknown> = {};
  const has = (k: string) => !partial || body[k] !== undefined;

  for (const [k, max] of Object.entries(PATIENT_TEXT_FIELDS)) {
    if (has(k)) data[k] = typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) || null : null;
  }
  if (has("species")) data.species = normalizeSpecies(String(body.species || "")) || String(body.species || "").trim() || null;
  if (has("sex")) data.sex = SEX_OPTIONS.includes(body.sex as (typeof SEX_OPTIONS)[number]) ? body.sex : null;
  if (has("neutered")) data.neutered = body.neutered === true;
  if (has("weight")) {
    const w = body.weight === null || body.weight === "" || body.weight === undefined ? null : Number(String(body.weight).replace(",", "."));
    if (w !== null && (!Number.isFinite(w) || w <= 0 || w > 2000)) return { error: "Peso inválido" } as const;
    data.weight = w;
  }
  if (has("birthDate")) {
    if (!body.birthDate) data.birthDate = null;
    else {
      const d = new Date(String(body.birthDate));
      if (Number.isNaN(d.getTime()) || d > new Date()) return { error: "Data de nascimento inválida" } as const;
      data.birthDate = d;
    }
  }
  if ((!partial || "name" in data) && !data.name) return { error: "Informe o nome do animal" } as const;
  if ((!partial || "ownerName" in data) && !data.ownerName) return { error: "Informe o responsável" } as const;
  if ((!partial || "species" in data) && !data.species) return { error: "Informe a espécie" } as const;
  return { data } as const;
}
